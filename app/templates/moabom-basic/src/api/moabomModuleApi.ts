/**
 * 모듈 API 공용 클라이언트 (SSOT) — 셸 앱/마이페이지/시스템 API 가 공유한다.
 *
 * 배경: 앱마다 `getBearerToken` + `fetch(/api/modules/<prefix>/...)` + 에러처리 보일러플레이트를
 *       복붙해 왔다(consultingApi·moabomAppsApi·myPageApi·moabomSystemApi). 이 파일이 단일 소스다.
 *
 * 두 가지 스타일을 제공한다:
 *   - `requestModuleApi` / `createModuleApi` : 성공 data 만 반환, 실패 시 throw (앱 API 권장)
 *   - `getBearerToken` : 토큰만 필요한 커스텀 fetch(마이페이지 avatar 업로드 등)용
 */

/** moabom 모듈 표준 JSON 응답 봉투. */
export interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, unknown>;
}

/** 코어(G7Core) 토큰 우선, 폴백으로 localStorage. 모든 인증 fetch 의 단일 소스. */
export function getBearerToken(): string | null {
  const G7Core = (window as unknown as { G7Core?: { api?: { getToken?: () => string | null } } }).G7Core;
  if (typeof G7Core?.api?.getToken === 'function') {
    const token = G7Core.api.getToken();
    if (token) return token;
  }
  return localStorage.getItem('auth_token');
}

/**
 * `/api/modules/<modulePrefix>/<path>` 로 인증 요청을 보내고 성공 시 `data` 를 반환한다.
 * 미인증/실패 시 throw 한다(호출부는 try/catch).
 */
export async function requestModuleApi<T>(
  modulePrefix: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getBearerToken();
  if (!token) {
    throw new Error('로그인이 필요합니다.');
  }

  const response = await fetch(`/api/modules/${modulePrefix}/${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || '요청 처리에 실패했습니다.');
  }
  return payload.data as T;
}

/** 모듈 prefix 에 바인딩된 `request<T>(path, init)` 를 만든다. 앱별 API 클라이언트 권장 진입점. */
export function createModuleApi(modulePrefix: string) {
  return <T>(path: string, init: RequestInit = {}): Promise<T> =>
    requestModuleApi<T>(modulePrefix, path, init);
}
