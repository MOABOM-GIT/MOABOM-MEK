import { useCallback, useEffect, useState } from 'react';
import { bootstrapMoabomShellAuthConfig } from '../../runtime/moabomShellAuth';
import { clearShellAccessToken, getShellAccessToken } from '../../api/moabomShellAccess';
import { buildMoaCurrentUser } from './moaHomeUser';
import type { AuthUserLike, MoaCurrentUser } from './moaHomeTypes';

interface UseMoabomShellAuthOptions {
  nameFallback: string;
}

interface AuthManagerSnapshot {
  isAuthenticated: () => boolean;
  getUser: () => AuthUserLike | null;
  preloadAuth: (type: 'user') => Promise<boolean>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
}

function getAuthManager(): AuthManagerSnapshot | null {
  const manager = (window as { G7Core?: { AuthManager?: { getInstance: () => AuthManagerSnapshot } } })
    .G7Core?.AuthManager?.getInstance?.();
  return manager ?? null;
}

/**
 * 홈 셸 인증 SSOT — G7 AuthManager 상태를 React UI에 미러링.
 *
 * 토큰이 없으면 /api/auth/user 를 호출하지 않는다.
 */
export function useMoabomShellAuth({ nameFallback }: UseMoabomShellAuthOptions) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<MoaCurrentUser | null>(null);

  const applyAuthState = useCallback(
    (authenticated: boolean, user: AuthUserLike | null | undefined) => {
      if (authenticated && user) {
        setIsLoggedIn(true);
        setCurrentUser(buildMoaCurrentUser(user, nameFallback));
        return;
      }
      setIsLoggedIn(false);
      setCurrentUser(null);
    },
    [nameFallback],
  );

  useEffect(() => {
    bootstrapMoabomShellAuthConfig();

    const authManager = getAuthManager();
    if (!authManager) {
      setIsLoggedIn(false);
      setCurrentUser(null);
      return;
    }

    const onAuthChange = (...args: unknown[]) => {
      const state = args[0] as { isAuthenticated?: boolean; user?: AuthUserLike | null } | undefined;
      applyAuthState(!!state?.isAuthenticated && !!state?.user, state?.user ?? null);
    };
    authManager.on('authStateChange', onAuthChange);

    let cancelled = false;
    void (async () => {
      if (authManager.isAuthenticated() && authManager.getUser()) {
        if (!cancelled) applyAuthState(true, authManager.getUser());
        return;
      }

      if (!getShellAccessToken()) {
        if (!cancelled) applyAuthState(false, null);
        return;
      }

      const ok = await authManager.preloadAuth('user');
      if (cancelled) return;
      if (ok && authManager.getUser()) {
        applyAuthState(true, authManager.getUser());
        return;
      }

      clearShellAccessToken();
      applyAuthState(false, null);
    })();

    return () => {
      cancelled = true;
    };
  }, [applyAuthState]);

  return {
    isLoggedIn,
    currentUser,
    setCurrentUser,
    applyAuthState,
  };
}
