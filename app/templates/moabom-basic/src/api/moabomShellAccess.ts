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

export function setShellAccessToken(token: string): void {
  const api = getG7ApiBridge();
  if (typeof api?.setToken === 'function') {
    api.setToken(token);
    return;
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
}

export function clearShellAccessToken(): void {
  const api = getG7ApiBridge();
  if (typeof api?.removeToken === 'function') {
    api.removeToken();
    return;
  }

  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}
