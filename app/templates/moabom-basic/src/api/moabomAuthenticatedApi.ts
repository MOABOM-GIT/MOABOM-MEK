/**
 * Moabom 세션 API — 마이페이지·코어 `/api/me` 등 **세션 경계** 전용.
 *
 * G7 `ApiClient`를 사용한다. 401 시 전역 onUnauthorized(로그인 리다이렉트)가 동작할 수 있다.
 * 셸 앱·모듈 API는 `moabomShellHttp` / `createShellModuleApi` 를 사용한다.
 */
import { moabomT } from '../i18n/moabomT';
import { getShellAccessToken } from './moabomShellAccess';

export interface MoabomApiResponseBody {
  success?: boolean;
  message?: string;
  errors?: Record<string, unknown>;
}

/** 세션 API 응답 — 서버 JSON + 클라이언트 `ok` 플래그. */
export type MoabomApiResult<T = unknown> = MoabomApiResponseBody & {
  ok: boolean;
  data?: T;
};

export type G7ApiClient = {
  getToken: () => string | null;
  get: <T>(url: string, config?: Record<string, unknown>) => Promise<T>;
  post: <T>(url: string, data?: unknown, config?: Record<string, unknown>) => Promise<T>;
  put: <T>(url: string, data?: unknown, config?: Record<string, unknown>) => Promise<T>;
  delete: <T>(url: string, config?: Record<string, unknown>) => Promise<T>;
};

export function getG7ApiClient(): G7ApiClient | null {
  const api = (window as { G7Core?: { api?: G7ApiClient } }).G7Core?.api;
  return api ?? null;
}

function axiosMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { message?: string } } })?.response;
  return response?.data?.message ?? fallback;
}

function authFailure<T>(message: string): MoabomApiResult<T> {
  return { ok: false, success: false, message };
}

function toMoabomApiResult<T>(
  error: unknown,
  fallback: string,
): MoabomApiResult<T> {
  return {
    ok: false,
    success: false,
    message: axiosMessage(error, fallback),
    errors: (error as { response?: { data?: { errors?: Record<string, unknown> } } })?.response?.data?.errors,
  };
}

function sessionAuthRequiredMessage(): string {
  return moabomT('moa_mypage.api.auth_required');
}

async function moabomSessionRequest<T>(
  invoke: (api: G7ApiClient) => Promise<MoabomApiResponseBody & { data?: T }>,
  authRequiredMessage = sessionAuthRequiredMessage(),
): Promise<MoabomApiResult<T>> {
  if (!getShellAccessToken()) {
    return authFailure<T>(authRequiredMessage);
  }

  const api = getG7ApiClient();
  if (!api) {
    return authFailure<T>(authRequiredMessage);
  }

  try {
    const payload = await invoke(api);
    return { ...payload, ok: !!payload.success };
  } catch (error) {
    return toMoabomApiResult<T>(error, authRequiredMessage);
  }
}

export async function moabomApiGet<T = unknown>(
  url: string,
  authRequiredMessage = sessionAuthRequiredMessage(),
): Promise<MoabomApiResult<T>> {
  return moabomSessionRequest<T>((api) => api.get(url), authRequiredMessage);
}

export async function moabomApiPost<T = unknown>(
  url: string,
  body?: unknown,
  authRequiredMessage = sessionAuthRequiredMessage(),
): Promise<MoabomApiResult<T>> {
  return moabomSessionRequest<T>((api) => api.post(url, body), authRequiredMessage);
}

export async function moabomApiPut<T = unknown>(
  url: string,
  body?: unknown,
  authRequiredMessage = sessionAuthRequiredMessage(),
): Promise<MoabomApiResult<T>> {
  return moabomSessionRequest<T>((api) => api.put(url, body), authRequiredMessage);
}

export async function moabomApiDelete<T = unknown>(
  url: string,
  authRequiredMessage = sessionAuthRequiredMessage(),
): Promise<MoabomApiResult<T>> {
  return moabomSessionRequest<T>((api) => api.delete(url), authRequiredMessage);
}














