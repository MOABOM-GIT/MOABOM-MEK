/**
 * 홈 셸 인증 preload — 부트 파이프라인 `auth-ready` 단계 SSOT.
 * React 훅·파이프라인이 동일 싱글톤을 공유해 /api/auth/user 중복 호출을 막는다.
 */

import { clearShellAccessToken, getShellAccessToken } from '../api/moabomShellAccess';

interface AuthManagerSnapshot {
  isAuthenticated: () => boolean;
  getUser: () => unknown;
  preloadAuth: (type: 'user') => Promise<boolean>;
}

function getAuthManager(): AuthManagerSnapshot | null {
  const manager = (window as {
    G7Core?: { AuthManager?: { getInstance: () => AuthManagerSnapshot } };
  }).G7Core?.AuthManager?.getInstance?.();
  return manager ?? null;
}

let authPreloadPromise: Promise<void> | null = null;

/**
 * 토큰 없으면 즉시 resolve. 있으면 G7 `preloadAuth('user')` 1회.
 */
export async function ensureMoabomShellAuthPreloaded(): Promise<void> {
  if (!getShellAccessToken()) {
    return;
  }

  if (authPreloadPromise) {
    return authPreloadPromise;
  }

  authPreloadPromise = (async () => {
    const authManager = getAuthManager();
    if (!authManager) {
      return;
    }

    if (authManager.isAuthenticated() && authManager.getUser()) {
      return;
    }

    const ok = await authManager.preloadAuth('user');
    if (!ok) {
      clearShellAccessToken();
    }
  })().finally(() => {
    authPreloadPromise = null;
  });

  return authPreloadPromise;
}

/** Vitest 격리 */
export function resetMoabomShellAuthPreloadForTest(): void {
  authPreloadPromise = null;
}
