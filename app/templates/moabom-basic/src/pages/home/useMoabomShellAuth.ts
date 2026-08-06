import { useCallback, useEffect, useState } from 'react';
import { bootstrapMoabomShellAuthConfig } from '../../runtime/moabomShellAuth';
import { ensureMoabomShellAuthPreloaded } from '../../runtime/moabomShellAuthPreload';
import { awaitMoabomBootPhaseAtLeast } from '../../runtime/moabomShellBootPipeline';
import { syncMoabomWebSocketAuth } from '../../runtime/moabomWebSocketAuthSync';
import { getShellAccessToken } from '../../api/moabomShellAccess';
import { MOABOM_SHELL_AUTH_EXPIRED_EVENT } from '../../i18n/moabomShellEvents';
import { installShellAuthStateKeyBridge, syncShellAuthStateKey } from '../../shell/moaShellAuthStateKey';
import { publishShellLayoutContext } from '../../shell/ShellContextBridge';
import { buildMoaCurrentUser, type AuthUserLike, type MoaCurrentUser } from '../../shell/moaShellTypes';
import { prefetchMoabomUserShellState } from '../../runtime/moabomUserShellState';
import {
  installMoabomShellAccountScopeBoundary,
  syncMoabomShellAccountScope,
} from '../../runtime/moabomShellAccountScope';

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

function hasAccessToken(): boolean {
  return !!getShellAccessToken();
}

/**
 * 홈 셸 인증 SSOT — G7 AuthManager 상태를 React UI에 미러링.
 *
 * AuthBoot 계약:
 * - 토큰이 있으면 optimistic logged-in (새로고침 시 로그인 풀림 체감 방지)
 * - preload 는 부트 파이프라인 `auth-ready` 와 공유
 * - 토큰 삭제는 확정 401 만 (preload 레이어)
 */
export function useMoabomShellAuth({ nameFallback }: UseMoabomShellAuthOptions) {
  const [isLoggedIn, setIsLoggedIn] = useState(() => hasAccessToken());
  const [currentUser, setCurrentUser] = useState<MoaCurrentUser | null>(null);

  const applyAuthState = useCallback(
    (authenticated: boolean, user: AuthUserLike | null | undefined) => {
      // React surface가 새 계정을 그리기 전에 이전 계정 module cache부터 원자적으로 폐기한다.
      syncMoabomShellAccountScope();
      if (authenticated && user) {
        void prefetchMoabomUserShellState();
        setIsLoggedIn(true);
        const nextUser = buildMoaCurrentUser(user, nameFallback);
        setCurrentUser(nextUser);
        syncShellAuthStateKey(nextUser?.memberKey);
        syncMoabomWebSocketAuth(true);
        publishShellLayoutContext(
          (window as { __templateApp?: { getGlobalState?: () => Record<string, unknown>; setGlobalState?: (u: Record<string, unknown>) => void } })
            .__templateApp,
        );
        return;
      }
      setIsLoggedIn(false);
      setCurrentUser(null);
      syncShellAuthStateKey(null);
      syncMoabomWebSocketAuth(false);
      publishShellLayoutContext(
        (window as { __templateApp?: { getGlobalState?: () => Record<string, unknown>; setGlobalState?: (u: Record<string, unknown>) => void } })
          .__templateApp,
      );
    },
    [nameFallback],
  );

  useEffect(() => {
    bootstrapMoabomShellAuthConfig();
    const teardownAccountScopeBoundary = installMoabomShellAccountScopeBoundary();
    const teardownAuthBridge = installShellAuthStateKeyBridge();

    const authManager = getAuthManager();
    let cancelled = false;

    if (!authManager) {
      if (!hasAccessToken()) {
        setIsLoggedIn(false);
        setCurrentUser(null);
      }
      const onShellAuthExpired = () => {
        if (!cancelled) {
          applyAuthState(false, null);
        }
      };
      window.addEventListener(MOABOM_SHELL_AUTH_EXPIRED_EVENT, onShellAuthExpired);
      return () => {
        cancelled = true;
        window.removeEventListener(MOABOM_SHELL_AUTH_EXPIRED_EVENT, onShellAuthExpired);
        teardownAccountScopeBoundary();
        teardownAuthBridge();
      };
    }

    const onAuthChange = (...args: unknown[]) => {
      const state = args[0] as { isAuthenticated?: boolean; user?: AuthUserLike | null } | undefined;
      applyAuthState(!!state?.isAuthenticated && !!state?.user, state?.user ?? null);
    };
    authManager.on('authStateChange', onAuthChange);

    const onShellAuthExpired = () => {
      if (!cancelled) {
        applyAuthState(false, null);
      }
    };
    window.addEventListener(MOABOM_SHELL_AUTH_EXPIRED_EVENT, onShellAuthExpired);

    void (async () => {
      if (authManager.isAuthenticated() && authManager.getUser()) {
        if (!cancelled) applyAuthState(true, authManager.getUser());
        return;
      }

      if (!hasAccessToken()) {
        if (!cancelled) applyAuthState(false, null);
        return;
      }

      // AuthBoot: 토큰 존재 → optimistic logged-in (user hydrate 전)
      if (!cancelled) {
        setIsLoggedIn(true);
        syncMoabomWebSocketAuth(true);
      }

      await awaitMoabomBootPhaseAtLeast('shell-critical');
      const preloadResult = await ensureMoabomShellAuthPreloaded();
      await awaitMoabomBootPhaseAtLeast('auth-ready');
      if (cancelled) return;

      if (authManager.isAuthenticated() && authManager.getUser()) {
        applyAuthState(true, authManager.getUser());
        return;
      }

      if (preloadResult === 'unauthorized' || !hasAccessToken()) {
        applyAuthState(false, null);
        return;
      }

      // transient: 토큰 유지, optimistic logged-in 유지 (user는 다음 authStateChange/재시도)
    })();

    return () => {
      cancelled = true;
      window.removeEventListener(MOABOM_SHELL_AUTH_EXPIRED_EVENT, onShellAuthExpired);
      teardownAccountScopeBoundary();
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
