/**
 * Moabom 세션 API — 마이페이지·코어 `/api/me` 등 **세션 경계** 전용.
 *
 * G7 `ApiClient`를 사용한다. 모듈 API는 `moabomShellHttp` / `createShellModuleApi` 를 사용한다.
 * 401 = unauthorized, 그 외 실패 = transient (토큰 유지·재로그인 문구 금지).
 */
import { moabomT } from '../i18n/moabomT';
import { getShellAccessToken } from './moabomShellAccess';

export interface MoabomApiResponseBody {
  success?: boolean;
  message?: string;
  errors?: Record<string, unknown>;
}

/** 세션 API 실패 종류 — UI 메시지 분기 SSOT */
export type MoabomSessionErrorKind = 'unauthorized' | 'transient';

/** 세션 API 응답 — 서버 JSON + 클라이언트 `ok`·`kind` 플래그. */
export type MoabomApiResult<T = unknown> = MoabomApiResponseBody & {
  ok: boolean;
  data?: T;
  /** ok=false 일 때만. 미설정은 하위 호환용 transient 취급 */
  kind?: MoabomSessionErrorKind;
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

function axiosStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

function authFailure<T>(message: string): MoabomApiResult<T> {
  return { ok: false, success: false, message, kind: 'unauthorized' };
}

function transientFailure<T>(message: string, errors?: Record<string, unknown>): MoabomApiResult<T> {
  return { ok: false, success: false, message, errors, kind: 'transient' };
}

function toMoabomApiResult<T>(
  error: unknown,
  fallback: string,
): MoabomApiResult<T> {
  const status = axiosStatus(error);
  const message = axiosMessage(error, fallback);
  const errors = (error as { response?: { data?: { errors?: Record<string, unknown> } } })?.response?.data?.errors;

  if (status === 401 || status === 403) {
    return {
      ok: false,
      success: false,
      message,
      errors,
      kind: 'unauthorized',
    };
  }

  return transientFailure<T>(message, errors);
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
    // G7 api 미준비 = 부트 레이스 — 재로그인으로 오판하지 않음
    return transientFailure<T>(authRequiredMessage);
  }

  try {
    const payload = await invoke(api);
    return { ...payload, ok: !!payload.success, kind: payload.success ? undefined : 'transient' };
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
