/**
 * Moabom 셸 HTTP — 모듈·앱 API 전용.
 *
 * G7 `ApiClient` 인터셉터(전역 onUnauthorized 리다이렉트)를 타지 않는 fetch 레이어.
 * 백엔드 미들웨어와 대응: none | optional.sanctum | auth:sanctum
 */
import { MOABOM_SHELL_AUTH_EXPIRED_EVENT } from '../i18n/moabomShellEvents';
import { moabomT } from '../i18n/moabomT';
import {
  clearShellAccessToken,
  getShellAccessToken,
  hasShellAccessToken,
} from './moabomShellAccess';

function publishShellAuthExpired(): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }
  window.dispatchEvent(new CustomEvent(MOABOM_SHELL_AUTH_EXPIRED_EVENT));
}

export type MoabomShellAuthMode = 'none' | 'optional' | 'required';

export const SHELL_AUTH_REQUIRED_CODE = 'SHELL_AUTH_REQUIRED' as const;
export const SHELL_AUTH_EXPIRED_CODE = 'SHELL_AUTH_EXPIRED' as const;

export class MoabomShellAuthRequiredError extends Error {
  readonly code = SHELL_AUTH_REQUIRED_CODE;

  constructor(message = moabomT('moa_mypage.api.auth_required')) {
    super(message);
    this.name = 'MoabomShellAuthRequiredError';
  }
}

export class MoabomShellAuthExpiredError extends Error {
  readonly code = SHELL_AUTH_EXPIRED_CODE;

  constructor(message = moabomT('moa_mypage.api.auth_required')) {
    super(message);
    this.name = 'MoabomShellAuthExpiredError';
  }
}

/** 모듈 API 비즈니스·HTTP 실패 — status·reason 으로 UI 분기 SSOT */
export class MoabomShellModuleApiError extends Error {
  readonly status: number;
  readonly reason?: string;

  constructor(status: number, message: string, payload: ShellJsonEnvelope) {
    super(message);
    this.name = 'MoabomShellModuleApiError';
    this.status = status;
    this.reason = extractShellModuleErrorReason(payload);
  }
}

export interface ShellJsonEnvelope<T = unknown> {
  success?: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, unknown>;
}

export interface ShellRequestInit extends Omit<RequestInit, 'body'> {
  body?: BodyInit | object | null;
  /** true면 401 시 토큰 갱신 1회 시도 (전역 리다이렉트 없음) */
  allowRefresh?: boolean;
}

function buildShellHeaders(init: ShellRequestInit, token: string | null): Headers {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const body = init.body;
  const isJsonBody = body != null && !(body instanceof FormData) && !(body instanceof URLSearchParams);
  if (isJsonBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (typeof window !== 'undefined') {
    const locale = localStorage.getItem('g7_locale');
    if (locale && !headers.has('Accept-Language')) {
      headers.set('Accept-Language', locale);
    }
  }

  return headers;
}

function serializeBody(body: ShellRequestInit['body']): BodyInit | undefined {
  if (body == null) {
    return undefined;
  }
  if (body instanceof FormData || body instanceof URLSearchParams || typeof body === 'string') {
    return body;
  }
  return JSON.stringify(body);
}

async function tryRefreshShellToken(): Promise<boolean> {
  const authManager = (window as {
    G7Core?: { AuthManager?: { getInstance?: () => { refreshToken?: () => Promise<boolean> } } };
  }).G7Core?.AuthManager?.getInstance?.();

  if (!authManager?.refreshToken) {
    return false;
  }

  try {
    return await authManager.refreshToken();
  } catch {
    return false;
  }
}

async function parseJsonResponse<T>(response: Response): Promise<ShellJsonEnvelope<T>> {
  try {
    return await response.json() as ShellJsonEnvelope<T>;
  } catch {
    return {};
  }
}

function httpErrorMessage(payload: ShellJsonEnvelope, fallback: string): string {
  return payload.message?.trim() || fallback;
}

export function extractShellModuleErrorReason(payload: ShellJsonEnvelope): string | undefined {
  const errors = payload.errors;
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) {
    return undefined;
  }
  const reason = (errors as Record<string, unknown>).reason;
  return typeof reason === 'string' && reason.trim() ? reason.trim() : undefined;
}

/**
 * 셸 모듈 API JSON 요청 SSOT.
 */
export async function requestShellJson<T>(
  url: string,
  authMode: MoabomShellAuthMode,
  init: ShellRequestInit = {},
): Promise<T> {
  const token = getShellAccessToken();

  if (authMode === 'required' && !token) {
    throw new MoabomShellAuthRequiredError();
  }

  const allowRefresh = init.allowRefresh !== false && !!token;
  const method = (init.method ?? 'GET').toUpperCase();
  const { body, allowRefresh: _allowRefresh, ...fetchInit } = init;

  const execute = async (bearer: string | null): Promise<Response> => {
    return fetch(url, {
      ...fetchInit,
      method,
      headers: buildShellHeaders(init, bearer),
      body: serializeBody(body),
    });
  };

  let response = await execute(token);

  if (response.status === 401 && allowRefresh) {
    const refreshed = await tryRefreshShellToken();
    if (refreshed) {
      response = await execute(getShellAccessToken());
    }
  }

  if (response.status === 401) {
    if (token) {
      clearShellAccessToken();
      publishShellAuthExpired();
      throw new MoabomShellAuthExpiredError();
    }
    throw new MoabomShellAuthRequiredError();
  }

  const payload = await parseJsonResponse<T>(response);

  if (!response.ok || !payload.success) {
    throw new MoabomShellModuleApiError(
      response.status,
      httpErrorMessage(payload, '요청 처리에 실패했습니다.'),
      payload,
    );
  }

  return payload.data as T;
}

export function assertShellAccessToken(): string {
  const token = getShellAccessToken();
  if (!token) {
    throw new MoabomShellAuthRequiredError();
  }
  return token;
}

export { hasShellAccessToken };

// ── `/api/modules/<prefix>/<path>` 바인딩 ─────────────────────────────

export type ShellModuleRequest = <T>(path: string, init?: ShellRequestInit) => Promise<T>;

function moduleUrl(modulePrefix: string, path: string): string {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return `/api/modules/${modulePrefix}/${normalized}`;
}

function createShellModuleRequest(modulePrefix: string, authMode: MoabomShellAuthMode): ShellModuleRequest {
  return <T>(path: string, init: ShellRequestInit = {}): Promise<T> =>
    requestShellJson<T>(moduleUrl(modulePrefix, path), authMode, init);
}

/** `auth:sanctum` — 토큰 없으면 네트워크 호출 없이 거부. */
export function createShellModuleApi(modulePrefix: string): ShellModuleRequest {
  return createShellModuleRequest(modulePrefix, 'required');
}

/** `optional.sanctum` — 토큰이 있으면 함께 전송, 없어도 요청. */
export function createOptionalShellModuleApi(modulePrefix: string): ShellModuleRequest {
  return createShellModuleRequest(modulePrefix, 'optional');
}

/** 공개 엔드포인트 — Authorization 없이 요청. */
export function createPublicShellModuleApi(modulePrefix: string): ShellModuleRequest {
  return createShellModuleRequest(modulePrefix, 'none');
}
