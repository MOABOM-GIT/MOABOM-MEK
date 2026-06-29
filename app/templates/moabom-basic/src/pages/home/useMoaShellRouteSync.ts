import { useCallback, useEffect, useRef } from 'react';
import type { AuthWindowMode } from '../../components/composite/Moa_AuthWindowContent';
import { awaitMoabomBootPhaseAtLeast } from '../../runtime/moabomShellBootPipeline';
import {
  installMoaShellBoardNavigateBridge,
  uninstallMoaShellBoardNavigateBridge,
} from '../../shell/installMoaShellBoardNavigateBridge';
import {
  installMoaShellErrorNavigateBridge,
  installMoaShellErrorPageHandlerBridge,
  ensureMoaShellErrorPageHandlerPatched,
  uninstallMoaShellErrorNavigateBridge,
} from '../../shell/installMoaShellErrorNavigateBridge';
import {
  isAnyErrorShellWindowOpen,
  markMoabomShellHomeMounted,
  takePendingShellError,
  type MoaShellErrorBridge,
} from '../../shell/moaShellErrorBridge';
import {
  isAnyShellNavigateWindowOpen,
  type MoaShellBoardBridge,
} from '../../shell/moaShellBoardBridge';
import { formatShellPath, parseShellRoute, pushShellPath, replaceShellPath } from '../../utils/moabomShellRoutes';
import type { ShellErrorCode } from '../../shell/moaShellErrorIds';
import type { BoardShellMode } from '../../utils/moabomShellRoutes';
import type { UserProfileWindowView } from '../../shell/userProfileWindowLayoutRuntime';
import type { WindowState } from '../../components/composite/Moa_CenterPanel';
import { isGuestOnlyAuthMode, type ShellUrlSync } from '../../shell/moaShellTypes';

type ShellWindowsApi = {
  windowsRef: React.MutableRefObject<WindowState[]>;
  applyShellRoute: (route: ReturnType<typeof parseShellRoute>) => void;
  openErrorWindow: (code: ShellErrorCode, sync?: ShellUrlSync) => boolean;
  closeErrorWindow: () => void;
  openBoardWindow: (slug: string, postId?: string, sync?: ShellUrlSync, boardMode?: BoardShellMode) => void;
  openAuthWindow: (mode: AuthWindowMode, sync?: ShellUrlSync) => void;
  openAppById: (appId: string, sync?: ShellUrlSync) => void;
  openMyPage: (tab: import('../../components/composite/mypage/myPageTypes').MyPageTab, sync?: ShellUrlSync) => void;
};

export interface UseMoaShellRouteSyncOptions extends ShellWindowsApi {
  initialWindow?: AuthWindowMode;
  isLoggedIn: boolean;
  openUserProfileWindow?: (
    userUuid: string,
    displayName?: string,
    sync?: ShellUrlSync,
    view?: UserProfileWindowView,
  ) => void;
}

export function useMoaShellRouteSync({
  windowsRef,
  applyShellRoute,
  openErrorWindow,
  closeErrorWindow,
  openBoardWindow,
  openAuthWindow,
  openAppById,
  openMyPage,
  openUserProfileWindow,
  initialWindow,
  isLoggedIn,
}: UseMoaShellRouteSyncOptions) {
  const shellRouteBootstrappedRef = useRef(false);
  const initialWindowOpenedRef = useRef<AuthWindowMode | null>(null);
  const applyingShellRouteRef = useRef(false);

  const openBoardWindowRef = useRef(openBoardWindow);
  openBoardWindowRef.current = openBoardWindow;
  const openAuthWindowRef = useRef(openAuthWindow);
  openAuthWindowRef.current = openAuthWindow;
  const openUserProfileWindowRef = useRef(openUserProfileWindow);
  openUserProfileWindowRef.current = openUserProfileWindow;
  const openAppByIdRef = useRef(openAppById);
  openAppByIdRef.current = openAppById;
  const openMyPageRef = useRef(openMyPage);
  openMyPageRef.current = openMyPage;
  const openErrorWindowRef = useRef(openErrorWindow);
  openErrorWindowRef.current = openErrorWindow;
  const closeErrorWindowRef = useRef(closeErrorWindow);
  closeErrorWindowRef.current = closeErrorWindow;

  const applyCurrentShellRoute = useCallback(() => {
    if (applyingShellRouteRef.current) {
      return;
    }

    applyingShellRouteRef.current = true;
    try {
      applyShellRoute(parseShellRoute(window.location.pathname, window.location.search));
    } finally {
      applyingShellRouteRef.current = false;
    }
  }, [applyShellRoute]);

  useEffect(() => {
    if (shellRouteBootstrappedRef.current) {
      return;
    }

    let cancelled = false;
    void (async () => {
      await awaitMoabomBootPhaseAtLeast('catalog-critical');
      if (cancelled || shellRouteBootstrappedRef.current) {
        return;
      }
      shellRouteBootstrappedRef.current = true;
      const route = parseShellRoute(window.location.pathname, window.location.search);
      if (route.kind !== 'home') {
        applyingShellRouteRef.current = true;
        try {
          applyShellRoute(route);
        } finally {
          applyingShellRouteRef.current = false;
        }
      } else {
        const pending = takePendingShellError();
        if (pending) {
          openErrorWindow(pending, { replace: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyShellRoute, openErrorWindow]);

  useEffect(() => {
    const onPathChanged = () => {
      applyCurrentShellRoute();
    };
    window.addEventListener('moabom-shell-path-changed', onPathChanged);
    return () => window.removeEventListener('moabom-shell-path-changed', onPathChanged);
  }, [applyCurrentShellRoute]);

  useEffect(() => {
    const onPop = () => {
      applyCurrentShellRoute();
    };
    window.addEventListener('popstate', onPop, true);
    return () => window.removeEventListener('popstate', onPop, true);
  }, [applyCurrentShellRoute]);

  useEffect(() => {
    const router = (window as { __templateApp?: { getRouter?: () => { on?: (e: string, h: () => void) => void } } })
      .__templateApp?.getRouter?.();
    if (!router?.on) return;
    const handler = () => {
      applyCurrentShellRoute();
    };
    router.on('routeChange', handler);
  }, [applyCurrentShellRoute]);

  useEffect(() => {
    markMoabomShellHomeMounted(true);

    const errorBridge: MoaShellErrorBridge = {
      isActive: () => isAnyErrorShellWindowOpen(windowsRef.current),
      openError: (code: ShellErrorCode, options?) => openErrorWindowRef.current(code, {
        skipUrl: options?.skipUrl === true,
        shellPath: options?.shellPath,
        replace: options?.replace ?? options?.shellPath != null,
      }),
      closeError: () => {
        closeErrorWindowRef.current();
      },
    };

    (window as { __moabomShellErrorBridge?: MoaShellErrorBridge | null }).__moabomShellErrorBridge = errorBridge;
    installMoaShellErrorNavigateBridge();
    installMoaShellErrorPageHandlerBridge();
    ensureMoaShellErrorPageHandlerPatched();

    return () => {
      markMoabomShellHomeMounted(false);
      (window as { __moabomShellErrorBridge?: MoaShellErrorBridge | null }).__moabomShellErrorBridge = null;
      uninstallMoaShellErrorNavigateBridge();
    };
  }, [windowsRef]);

  useEffect(() => {
    const bridge: MoaShellBoardBridge = {
      isActive: () => isAnyShellNavigateWindowOpen(windowsRef.current),
      openBoard: (slug, postId, options) => {
        openBoardWindowRef.current(slug, postId, {
          skipUrl: true,
          shellPath: options?.shellPath,
          replace: options?.replace,
        } as ShellUrlSync, options?.boardMode as BoardShellMode | undefined);
      },
      openAuth: (mode) => {
        openAuthWindowRef.current(mode, { skipUrl: true });
        replaceShellPath(formatShellPath({ kind: 'auth', mode }));
      },
      openUserProfile: (userUuid, view = 'profile', options) => {
        openUserProfileWindowRef.current?.(userUuid, undefined, {
          skipUrl: true,
          shellPath: options?.shellPath,
          replace: options?.replace,
        }, view);
      },
      openAppById: (appId, options) => {
        openAppByIdRef.current(appId, {
          skipUrl: true,
          shellPath: options?.shellPath,
          replace: options?.replace,
        });
      },
      openMyPage: (tab, options) => {
        const shellPath = options?.shellPath ?? formatShellPath({ kind: 'me', tab });
        openMyPageRef.current(tab, { skipUrl: true });
        if (options?.replace) {
          replaceShellPath(shellPath);
        } else {
          pushShellPath(shellPath);
        }
      },
    };

    (window as { __moabomShellBoardBridge?: MoaShellBoardBridge | null }).__moabomShellBoardBridge = bridge;
    installMoaShellBoardNavigateBridge();

    return () => {
      (window as { __moabomShellBoardBridge?: MoaShellBoardBridge | null }).__moabomShellBoardBridge = null;
      uninstallMoaShellBoardNavigateBridge();
    };
  }, [windowsRef]);

  useEffect(() => {
    if (!initialWindow) return;
    if (initialWindowOpenedRef.current === initialWindow) return;
    if (isLoggedIn && isGuestOnlyAuthMode(initialWindow)) return;
    initialWindowOpenedRef.current = initialWindow;
    openAuthWindow(initialWindow);
  }, [initialWindow, openAuthWindow, isLoggedIn]);
}
