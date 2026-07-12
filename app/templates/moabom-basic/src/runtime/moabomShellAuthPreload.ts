/**
 * 홈 셸 인증 preload — 부트 파이프라인 `auth-ready` 단계 SSOT.
 * React 훅·파이프라인이 동일 싱글톤을 공유해 /api/auth/user 중복 호출을 막는다.
 *
 * AuthBoot 계약: 토큰 삭제는 확정 401(무효)일 때만. 일시 네트워크 실패로 clear 금지.
 * TemplateApp preloadAuth 와의 합류는 `installMoabomShellAuthSingleFlight` (preloadAuth 단일 비행).
 */

import { clearShellAccessToken, getShellAccessToken } from '../api/moabomShellAccess';
import { installMoabomShellAuthSingleFlight } from './moabomShellAuthSingleFlight';

interface AuthManagerSnapshot {
  isAuthenticated: () => boolean;
  getUser: () => unknown;
  preloadAuth: (type: 'user') => Promise<boolean>;
}

export type ShellAuthPreloadResult = 'ready' | 'guest' | 'unauthorized' | 'transient';

/** ApiClient baseURL(`/api`) + AuthManager userEndpoint 와 동일 */
const USER_AUTH_ENDPOINT = '/api/auth/user';

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

let authPreloadPromise: Promise<ShellAuthPreloadResult> | null = null;
let authPreloadCached: ShellAuthPreloadResult | null = null;

/**
 * Bearer 로 /api/auth/user 를 한 번 더 찔러 HTTP 상태를 확인한다.
 * AuthManager.preloadAuth 는 실패 사유를 구분하지 않으므로 AuthBoot 계약용.
 * SPA HTML(`/auth/user`) 200 을 API 성공으로 오인하지 않도록 JSON content-type 필수.
 */
async function probeAuthUserHttpStatus(token: string): Promise<number | null> {
  try {
    const response = await fetch(USER_AUTH_ENDPOINT, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'same-origin',
    });
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return null;
    }
    return response.status;
  } catch {
    return null;
  }
}

function readCachedResult(): ShellAuthPreloadResult | null {
  if (!authPreloadCached) {
    return null;
  }

  if (authPreloadCached === 'ready') {
    return getShellAccessToken() ? 'ready' : null;
  }

  if (authPreloadCached === 'guest') {
    return getShellAccessToken() ? null : 'guest';
  }

  if (authPreloadCached === 'unauthorized') {
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
  if (!getShellAccessToken()) {
    authPreloadCached = 'guest';
    return 'guest';
  }

  const cached = readCachedResult();
  if (cached) {
    return cached;
  }

  if (authPreloadPromise) {
    return authPreloadPromise;
  }

  authPreloadPromise = (async (): Promise<ShellAuthPreloadResult> => {
    const authManager = getAuthManager();
    if (!authManager) {
      return 'transient';
    }

    if (authManager.isAuthenticated() && authManager.getUser()) {
      return 'ready';
    }

    const ok = await authManager.preloadAuth('user');
    if (ok) {
      return 'ready';
    }

    const token = getShellAccessToken();
    if (!token) {
      return 'unauthorized';
    }

    const status = await probeAuthUserHttpStatus(token);
    if (status === 401) {
      clearShellAccessToken();
      return 'unauthorized';
    }

    // 네트워크 오류(null)·비JSON·5xx 등 — 토큰 유지
    return 'transient';
  })();

  try {
    const result = await authPreloadPromise;
    if (CACHEABLE_RESULTS.has(result)) {
      authPreloadCached = result;
    }
    return result;
  } finally {
    authPreloadPromise = null;
  }
}

/** Vitest 격리 */
export function resetMoabomShellAuthPreloadForTest(): void {
  authPreloadPromise = null;
  authPreloadCached = null;
}

/** 테스트·디버그용 probe URL SSOT */
export const MOABOM_SHELL_AUTH_USER_ENDPOINT = USER_AUTH_ENDPOINT;
