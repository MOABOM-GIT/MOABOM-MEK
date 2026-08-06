/**
 * Moabom 셸 액세스 토큰 SSOT.
 *
 * 저장소는 G7 `ApiClient`(localStorage `auth_token`)와 동일하며,
 * 셸·모듈 API는 이 모듈만 통해 읽기/쓰기/삭제한다.
 */

type G7ApiTokenBridge = {
  getToken?: () => string | null;
  setToken?: (token: string) => void;
  removeToken?: () => void;
};

const TOKEN_STORAGE_KEY = 'auth_token';
let observedScopeToken: string | null | undefined;
let accessScopeGeneration = 0;

function getG7ApiBridge(): G7ApiTokenBridge | null {
  return (window as { G7Core?: { api?: G7ApiTokenBridge } }).G7Core?.api ?? null;
}

/** 현재 액세스 토큰 (없으면 null). */
export function getShellAccessToken(): string | null {
  const api = getG7ApiBridge();
  if (typeof api?.getToken === 'function') {
    const token = api.getToken();
    if (token) {
      return token;
    }
  }

  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function hasShellAccessToken(): boolean {
  return !!getShellAccessToken();
}

/**
 * 현재 탭의 인증 캐시 스코프. 토큰 원문을 캐시 키에 노출하지 않고,
 * 계정·토큰 전환마다 세대만 증가시킨다.
 */
export function getShellAccessScopeKey(): string {
  const token = getShellAccessToken();
  if (token !== observedScopeToken) {
    observedScopeToken = token;
    accessScopeGeneration += 1;
  }
  return token ? `auth:${accessScopeGeneration}` : 'guest';
}

export function setShellAccessToken(token: string): void {
  const api = getG7ApiBridge();
  if (typeof api?.setToken === 'function') {
    api.setToken(token);
  } else if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('moabom:auth-token-changed'));
  }
}

export function clearShellAccessToken(): void {
  const api = getG7ApiBridge();
  if (typeof api?.removeToken === 'function') {
    api.removeToken();
  } else if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('moabom:auth-token-changed'));
  }
}
