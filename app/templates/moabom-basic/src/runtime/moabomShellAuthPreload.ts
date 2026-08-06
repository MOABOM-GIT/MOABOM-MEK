/**
 * 홈 셸 인증 preload — 부트 파이프라인 `auth-ready` 단계 SSOT.
 * React 훅·파이프라인이 동일 싱글톤을 공유해 /api/auth/user 중복 호출을 막는다.
 *
 * AuthBoot 계약: 토큰 삭제는 확정 401(무효)일 때만. 일시 네트워크 실패로 clear 금지.
 * TemplateApp preloadAuth 와의 합류는 `installMoabomShellAuthSingleFlight` (preloadAuth 단일 비행).
 */

import {
  clearShellAccessToken,
  getShellAccessScopeKey,
  getShellAccessToken,
} from '../api/moabomShellAccess';
import { installMoabomShellAuthSingleFlight } from './moabomShellAuthSingleFlight';

interface AuthManagerSnapshot {
  isAuthenticated: () => boolean;
  getUser: () => unknown;
  preloadAuth: (type: 'user') => Promise<boolean>;
}

export type ShellAuthPreloadResult = 'ready' | 'guest' | 'unauthorized' | 'transient';

/** ApiClient baseURL(`/api`) + AuthManager userEndpoint 와 동일 */
const USER_AUTH_ENDPOINT = '/api/auth/user';
/** Cloud Run upstream 504(15s) 전에 클라이언트에서 끊는다 */
const AUTH_PRELOAD_TIMEOUT_MS = 8_000;
/** preloadAuth 내부 fetch 캡처 재사용 허용 창 */
const CAPTURED_STATUS_TTL_MS = 2_000;

const CACHEABLE_RESULTS: ReadonlySet<ShellAuthPreloadResult> = new Set([
  'ready',
  'guest',
  'unauthorized',
]);

function getAuthManager(): AuthManagerSnapshot | null {
  installMoabomShellAuthSingleFlight();
  const manager = (window as {
    G7Core?: { AuthManager?: { getInstance: () => AuthManagerSnapshot } };
  }).G7Core?.AuthManager?.getInstance?.();
  return manager ?? null;
}

let authPreloadPromise: {
  scopeKey: string;
  promise: Promise<ShellAuthPreloadResult>;
} | null = null;
let authPreloadCached: {
  scopeKey: string;
  result: ShellAuthPreloadResult;
} | null = null;
let lastCapturedAuthUser: {
  scopeKey: string;
  status: number | null;
  at: number;
} | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      () => {
        window.clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

function isAuthUserUrl(raw: string): boolean {
  try {
    const path = new URL(raw, window.location.origin).pathname;
    return path === USER_AUTH_ENDPOINT || path === '/auth/user';
  } catch {
    return raw.includes(USER_AUTH_ENDPOINT) || raw.endsWith('/auth/user');
  }
}

function rememberAuthUserResponse(response: Response, scopeKey = getShellAccessScopeKey()): void {
  const contentType = response.headers.get('content-type') ?? '';
  lastCapturedAuthUser = {
    scopeKey,
    status: contentType.includes('application/json') ? response.status : null,
    at: Date.now(),
  };
}

/**
 * preloadAuth(checkAuth) 가 이미 친 /api/auth/user 응답 상태를 캡처한다.
 * 실패 후 동일 RTT probe 를 한 번 더 치지 않기 위함.
 */
async function withAuthUserStatusCapture<T>(run: () => Promise<T>): Promise<T> {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return run();
  }

  const originalFetch = window.fetch.bind(window);
  const scopeKey = getShellAccessScopeKey();
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await originalFetch(input, init);
    try {
      const raw = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
      if (isAuthUserUrl(raw)) {
        rememberAuthUserResponse(response, scopeKey);
      }
    } catch {
      // ignore capture errors
    }
    return response;
  }) as typeof window.fetch;

  try {
    return await run();
  } finally {
    window.fetch = originalFetch;
  }
}

/**
 * Bearer 로 /api/auth/user 를 한 번 더 찔러 HTTP 상태를 확인한다.
 * AuthManager.preloadAuth 는 실패 사유를 구분하지 않으므로 AuthBoot 계약용.
 * SPA HTML(`/auth/user`) 200 을 API 성공으로 오인하지 않도록 JSON content-type 필수.
 */
async function probeAuthUserHttpStatus(token: string, scopeKey: string): Promise<number | null> {
  const ctrl = new AbortController();
  const timeoutId = window.setTimeout(() => ctrl.abort(), AUTH_PRELOAD_TIMEOUT_MS);
  try {
    const response = await fetch(USER_AUTH_ENDPOINT, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'same-origin',
      signal: ctrl.signal,
    });
    rememberAuthUserResponse(response, scopeKey);
    return lastCapturedAuthUser?.scopeKey === scopeKey
      ? lastCapturedAuthUser.status
      : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function readCapturedAuthUserStatus(scopeKey: string): number | null | undefined {
  if (!lastCapturedAuthUser || lastCapturedAuthUser.scopeKey !== scopeKey) {
    return undefined;
  }
  if (Date.now() - lastCapturedAuthUser.at > CAPTURED_STATUS_TTL_MS) {
    return undefined;
  }
  return lastCapturedAuthUser.status;
}

function readCachedResult(): ShellAuthPreloadResult | null {
  const scopeKey = getShellAccessScopeKey();
  if (!authPreloadCached || authPreloadCached.scopeKey !== scopeKey) {
    return null;
  }

  if (authPreloadCached.result === 'ready') {
    return getShellAccessToken() ? 'ready' : null;
  }

  if (authPreloadCached.result === 'guest') {
    return getShellAccessToken() ? null : 'guest';
  }

  if (authPreloadCached.result === 'unauthorized') {
    return 'unauthorized';
  }

  return null;
}

/**
 * 토큰 없으면 guest. 있으면 G7 `preloadAuth('user')` 1회( single-flight 합류 ).
 * 실패 시 401만 토큰 삭제, 그 외는 transient(토큰 유지).
 * ready/guest/unauthorized 는 세션 내 캐시 — transient 만 재시도 허용.
 */
export async function ensureMoabomShellAuthPreloaded(): Promise<ShellAuthPreloadResult> {
  const scopeKey = getShellAccessScopeKey();
  if (!getShellAccessToken()) {
    authPreloadCached = { scopeKey, result: 'guest' };
    return 'guest';
  }

  const cached = readCachedResult();
  if (cached) {
    return cached;
  }

  if (authPreloadPromise?.scopeKey === scopeKey) {
    return authPreloadPromise.promise;
  }

  const promise = (async (): Promise<ShellAuthPreloadResult> => {
    const authManager = getAuthManager();
    if (!authManager) {
      return 'transient';
    }

    if (authManager.isAuthenticated() && authManager.getUser()) {
      return 'ready';
    }

    const ok = await withAuthUserStatusCapture(() => withTimeout(
      authManager.preloadAuth('user'),
      AUTH_PRELOAD_TIMEOUT_MS,
      false,
    ));
    if (ok) {
      return 'ready';
    }

    const token = getShellAccessToken();
    if (!token) {
      return 'unauthorized';
    }

    const captured = readCapturedAuthUserStatus(scopeKey);
    const status = captured !== undefined
      ? captured
      : await probeAuthUserHttpStatus(token, scopeKey);
    if (status === 401 && scopeKey === getShellAccessScopeKey()) {
      clearShellAccessToken();
      return 'unauthorized';
    }

    // 네트워크 오류(null)·비JSON·5xx 등 — 토큰 유지
    return 'transient';
  })();
  const entry = { scopeKey, promise };
  authPreloadPromise = entry;

  try {
    const result = await promise;
    if (scopeKey === getShellAccessScopeKey() && CACHEABLE_RESULTS.has(result)) {
      authPreloadCached = { scopeKey, result };
    }
    return result;
  } finally {
    if (authPreloadPromise === entry) {
      authPreloadPromise = null;
    }
  }
}

/** 인증 계정 경계 전환 — 이전 토큰의 캐시·single-flight·HTTP 상태 캡처를 폐기한다. */
export function invalidateMoabomShellAuthPreload(): void {
  authPreloadPromise = null;
  authPreloadCached = null;
  lastCapturedAuthUser = null;
}

/** Vitest 격리 */
export function resetMoabomShellAuthPreloadForTest(): void {
  invalidateMoabomShellAuthPreload();
}

/** 테스트·디버그용 probe URL SSOT */
export const MOABOM_SHELL_AUTH_USER_ENDPOINT = USER_AUTH_ENDPOINT;
