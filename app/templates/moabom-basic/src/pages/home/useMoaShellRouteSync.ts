import { useEffect, useRef } from 'react';
import type { AuthWindowMode } from '../../components/composite/Moa_AuthWindowContent';
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
  isAnyBoardShellWindowOpen,
  type MoaShellBoardBridge,
} from '../../shell/moaShellBoardBridge';
import { formatShellPath, parseShellRoute, replaceShellPath } from '../../utils/moabomShellRoutes';
import type { ShellErrorCode } from '../../shell/moaShellErrorIds';
import type { BoardShellMode } from '../../utils/moabomShellRoutes';
import type { WindowState } from '../../components/composite/Moa_CenterPanel';
import { isGuestOnlyAuthMode, type ShellUrlSync } from '../../shell/moaShellTypes';

type ShellWindowsApi = {
  windowsRef: React.MutableRefObject<WindowState[]>;
  applyShellRoute: (route: ReturnType<typeof parseShellRoute>) => void;
  openErrorWindow: (code: ShellErrorCode, sync?: ShellUrlSync) => boolean;
  closeErrorWindow: () => void;
  openBoardWindow: (slug: string, postId?: string, sync?: ShellUrlSync, boardMode?: BoardShellMode) => void;
  openAuthWindow: (mode: AuthWindowMode, sync?: ShellUrlSync) => void;
};

export interface UseMoaShellRouteSyncOptions extends ShellWindowsApi {
  initialWindow?: AuthWindowMode;
  isLoggedIn: boolean;
  openUserProfileWindow?: (userUuid: string, displayName?: string, sync?: ShellUrlSync) => void;
}

export function useMoaShellRouteSync({
  windowsRef,
  applyShellRoute,
  openErrorWindow,
  closeErrorWindow,
  openBoardWindow,
  openAuthWindow,
  openUserProfileWindow,
  initialWindow,
  isLoggedIn,
}: UseMoaShellRouteSyncOptions) {
  const shellRouteBootstrappedRef = useRef(false);
  const initialWindowOpenedRef = useRef<AuthWindowMode | null>(null);

  const openBoardWindowRef = useRef(openBoardWindow);
  openBoardWindowRef.current = openBoardWindow;
  const openAuthWindowRef = useRef(openAuthWindow);
  openAuthWindowRef.current = openAuthWindow;
  const openUserProfileWindowRef = useRef(openUserProfileWindow);
  openUserProfileWindowRef.current = openUserProfileWindow;
  const openErrorWindowRef = useRef(openErrorWindow);
  openErrorWindowRef.current = openErrorWindow;
  const closeErrorWindowRef = useRef(closeErrorWindow);
  closeErrorWindowRef.current = closeErrorWindow;

  useEffect(() => {
    if (shellRouteBootstrappedRef.current) return;
    shellRouteBootstrappedRef.current = true;
    const route = parseShellRoute(window.location.pathname, window.location.search);
    if (route.kind !== 'home') {
      applyShellRoute(route);
    } else {
      const pending = takePendingShellError();
      if (pending) {
        openErrorWindow(pending, { replace: true });
      }
    }
  }, [applyShellRoute, openErrorWindow]);

  useEffect(() => {
    const onPop = () => {
      applyShellRoute(parseShellRoute(window.location.pathname, window.location.search));
    };
    window.addEventListener('popstate', onPop, true);
    return () => window.removeEventListener('popstate', onPop, true);
  }, [applyShellRoute]);

  useEffect(() => {
    const router = (window as { __templateApp?: { getRouter?: () => { on?: (e: string, h: () => void) => void } } })
      .__templateApp?.getRouter?.();
    if (!router?.on) return;
    const handler = () => {
      applyShellRoute(parseShellRoute(window.location.pathname, window.location.search));
    };
    router.on('routeChange', handler);
  }, [applyShellRoute]);

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
      isActive: () => isAnyBoardShellWindowOpen(windowsRef.current),
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
      openUserProfile: (userUuid) => {
        openUserProfileWindowRef.current?.(userUuid, undefined, { skipUrl: true });
        replaceShellPath(formatShellPath({ kind: 'userProfile', uuid: userUuid }));
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
