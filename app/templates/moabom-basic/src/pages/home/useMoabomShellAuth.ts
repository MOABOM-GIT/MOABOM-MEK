import { useCallback, useEffect, useState } from 'react';
import { bootstrapMoabomShellAuthConfig } from '../../runtime/moabomShellAuth';
import { ensureMoabomShellAuthPreloaded } from '../../runtime/moabomShellAuthPreload';
import { awaitMoabomBootPhaseAtLeast } from '../../runtime/moabomShellBootPipeline';
import { syncMoabomWebSocketAuth } from '../../runtime/moabomWebSocketAuthSync';
import { clearShellAccessToken, getShellAccessToken } from '../../api/moabomShellAccess';
import { installShellAuthStateKeyBridge, syncShellAuthStateKey } from '../../shell/moaShellAuthStateKey';
import { buildMoaCurrentUser, type AuthUserLike, type MoaCurrentUser } from '../../shell/moaShellTypes';

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
 * preload 는 부트 파이프라인 `auth-ready` 와 공유한다.
 */
export function useMoabomShellAuth({ nameFallback }: UseMoabomShellAuthOptions) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<MoaCurrentUser | null>(null);

  const applyAuthState = useCallback(
    (authenticated: boolean, user: AuthUserLike | null | undefined) => {
      if (authenticated && user) {
        setIsLoggedIn(true);
        const nextUser = buildMoaCurrentUser(user, nameFallback);
        setCurrentUser(nextUser);
        syncShellAuthStateKey(nextUser?.memberKey);
        syncMoabomWebSocketAuth(true);
        return;
      }
      setIsLoggedIn(false);
      setCurrentUser(null);
      syncShellAuthStateKey(null);
      syncMoabomWebSocketAuth(false);
    },
    [nameFallback],
  );

  useEffect(() => {
    bootstrapMoabomShellAuthConfig();
    const teardownAuthBridge = installShellAuthStateKeyBridge();

    const authManager = getAuthManager();
    let cancelled = false;

    if (!authManager) {
      setIsLoggedIn(false);
      setCurrentUser(null);
      return () => {
        teardownAuthBridge();
      };
    }

    const onAuthChange = (...args: unknown[]) => {
      const state = args[0] as { isAuthenticated?: boolean; user?: AuthUserLike | null } | undefined;
      applyAuthState(!!state?.isAuthenticated && !!state?.user, state?.user ?? null);
    };
    authManager.on('authStateChange', onAuthChange);

    void (async () => {
      if (authManager.isAuthenticated() && authManager.getUser()) {
        if (!cancelled) applyAuthState(true, authManager.getUser());
        return;
      }

      if (!getShellAccessToken()) {
        if (!cancelled) applyAuthState(false, null);
        return;
      }

      await awaitMoabomBootPhaseAtLeast('shell-critical');
      await ensureMoabomShellAuthPreloaded();
      await awaitMoabomBootPhaseAtLeast('auth-ready');
      if (cancelled) return;

      if (authManager.isAuthenticated() && authManager.getUser()) {
        applyAuthState(true, authManager.getUser());
        return;
      }

      clearShellAccessToken();
      applyAuthState(false, null);
    })();

    return () => {
      cancelled = true;
      teardownAuthBridge();
    };
  }, [applyAuthState]);

  return {
    isLoggedIn,
    currentUser,
    setCurrentUser,
    applyAuthState,
  };
}
