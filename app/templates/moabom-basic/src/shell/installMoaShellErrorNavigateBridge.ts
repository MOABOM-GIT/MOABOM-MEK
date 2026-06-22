import { formatShellPath, replaceShellPath } from '../utils/moabomShellRoutes';
import { getMoaShellBoardBridge } from './moaShellBoardBridge';
import {
  getMoaShellErrorBridge,
  isMoabomShellHomeMounted,
  setPendingShellError,
} from './moaShellErrorBridge';
import { mapHttpStatusToShellErrorCode, type ShellErrorCode } from './moaShellErrorIds';
import { tryHandleErrorShellNavigate } from './moaShellErrorNavigate';

type RouterLike = {
  navigate: (path: string) => void;
  navigateToCurrentPath?: () => Promise<void>;
  __moabomErrorNavPatched?: boolean;
};

type G7CoreLike = {
  updateQueryParams?: (newPath: string, options?: { transitionOverlayTarget?: string }) => Promise<void>;
  __moabomErrorUpdateQueryPatched?: boolean;
};

type ErrorPageHandlerLike = {
  renderError: (errorCode: number, containerId?: string) => Promise<boolean>;
  __moabomErrorHandlerPatched?: boolean;
};

let originalNavigate: ((path: string) => void) | null = null;
let originalUpdateQueryParams: ((newPath: string, options?: { transitionOverlayTarget?: string }) => Promise<void>) | null = null;

function isErrorShellRecoveryActive(): boolean {
  return (window as { __moabomErrorShellRecovering?: boolean }).__moabomErrorShellRecovering === true;
}

function setErrorShellRecoveryActive(active: boolean): void {
  (window as { __moabomErrorShellRecovering?: boolean }).__moabomErrorShellRecovering = active;
}

/**
 * Ghost shell 스냅샷에 에러 경로가 없을 때 — home(`/`) 로드 후 pending error 윈도우.
 * `/404` 등 미등록 경로로 navigateToCurrentPath 하면 routeNotFound 가 반복된다.
 */
async function recoverShellHomeForError(
  shellCode: ShellErrorCode,
  router: RouterLike,
): Promise<boolean> {
  if (isErrorShellRecoveryActive()) {
    return true;
  }

  setErrorShellRecoveryActive(true);
  try {
    setPendingShellError(shellCode);
    replaceShellPath('/');
    await router.navigateToCurrentPath?.();
    return true;
  } catch {
    return false;
  } finally {
    setErrorShellRecoveryActive(false);
  }
}

function getTemplateRouter(): RouterLike | null {
  return (window as { __templateApp?: { getRouter?: () => RouterLike | null } })
    .__templateApp?.getRouter?.() ?? null;
}

export function installMoaShellErrorNavigateBridge(): void {
  if (typeof window === 'undefined') return;

  const router = getTemplateRouter();
  if (router && !router.__moabomErrorNavPatched) {
    originalNavigate = router.navigate.bind(router);
    router.navigate = (path: string) => {
      const errorBridge = getMoaShellErrorBridge();
      if (errorBridge && tryHandleErrorShellNavigate(path, errorBridge)) {
        return;
      }
      originalNavigate?.(path);
    };
    router.__moabomErrorNavPatched = true;
  }

  const G7Core = (window as { G7Core?: G7CoreLike }).G7Core;
  if (G7Core?.updateQueryParams && !G7Core.__moabomErrorUpdateQueryPatched) {
    originalUpdateQueryParams = G7Core.updateQueryParams.bind(G7Core);
    G7Core.updateQueryParams = async (newPath: string, options?: { transitionOverlayTarget?: string }) => {
      const errorBridge = getMoaShellErrorBridge();
      if (errorBridge && tryHandleErrorShellNavigate(newPath, errorBridge)) {
        return;
      }
      return originalUpdateQueryParams?.(newPath, options);
    };
    G7Core.__moabomErrorUpdateQueryPatched = true;
  }
}

/**
 * ErrorPageHandler.renderError 가로채기.
 * @returns 패치 적용(이미 적용 포함) 시 true, handler 미준비 시 false
 */
export function installMoaShellErrorPageHandlerBridge(): boolean {
  if (typeof window === 'undefined') return false;

  const templateApp = (window as {
    __templateApp?: { getErrorPageHandler?: () => ErrorPageHandlerLike | null };
  }).__templateApp;

  const handler = templateApp?.getErrorPageHandler?.();
  if (!handler) {
    return false;
  }
  if (handler.__moabomErrorHandlerPatched) {
    return true;
  }

  const originalRenderError = handler.renderError.bind(handler);
  handler.renderError = async (errorCode: number, containerId = 'app') => {
    if (containerId !== 'app') {
      return originalRenderError(errorCode, containerId);
    }

    // P2: 401 → 셸 auth 윈도우 (풀스크린 403 레이아웃 대신)
    if (errorCode === 401) {
      if (isMoabomShellHomeMounted()) {
        const boardBridge = getMoaShellBoardBridge();
        if (boardBridge) {
          boardBridge.openAuth('login');
          return true;
        }
      }
      return originalRenderError(errorCode, containerId);
    }

    const shellCode = mapHttpStatusToShellErrorCode(errorCode);
    if (!shellCode) {
      return originalRenderError(errorCode, containerId);
    }

    const errorPath = formatShellPath({ kind: 'error', code: shellCode });

    if (isMoabomShellHomeMounted()) {
      const bridge = getMoaShellErrorBridge();
      if (bridge) {
        const opened = bridge.openError(shellCode, { replace: true, shellPath: errorPath });
        if (opened) {
          return true;
        }
      }
      return originalRenderError(errorCode, containerId);
    }

    // P0: 부트 전 routeNotFound — home 레이아웃 로드 후 pending error 윈도우
    const router = getTemplateRouter();
    if (!router?.navigateToCurrentPath) {
      return originalRenderError(errorCode, containerId);
    }

    const recovered = await recoverShellHomeForError(shellCode, router);
    if (recovered) {
      return true;
    }

    return originalRenderError(errorCode, containerId);
  };
  handler.__moabomErrorHandlerPatched = true;
  return true;
}

/** TemplateApp.init 이전에도 패치 — routeNotFound 풀스크린 404 방지 */
export function ensureMoaShellErrorPageHandlerPatched(): void {
  if (typeof window === 'undefined') return;

  const win = window as { __moabomErrorHandlerPatchScheduled?: boolean };
  if (win.__moabomErrorHandlerPatchScheduled) {
    return;
  }
  win.__moabomErrorHandlerPatchScheduled = true;

  let attempts = 0;
  const maxAttempts = 600;

  const tryPatch = () => {
    if (installMoaShellErrorPageHandlerBridge()) {
      return;
    }
    attempts += 1;
    if (attempts >= maxAttempts) {
      return;
    }
    requestAnimationFrame(tryPatch);
  };
  tryPatch();
}

export function uninstallMoaShellErrorNavigateBridge(): void {
  if (typeof window === 'undefined') return;

  const router = getTemplateRouter();
  if (router?.__moabomErrorNavPatched && originalNavigate) {
    router.navigate = originalNavigate;
    delete router.__moabomErrorNavPatched;
    originalNavigate = null;
  }

  const G7Core = (window as { G7Core?: G7CoreLike }).G7Core;
  if (G7Core?.__moabomErrorUpdateQueryPatched && originalUpdateQueryParams) {
    G7Core.updateQueryParams = originalUpdateQueryParams;
    delete G7Core.__moabomErrorUpdateQueryPatched;
    originalUpdateQueryParams = null;
  }
}
