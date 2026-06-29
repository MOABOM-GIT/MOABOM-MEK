import { getMoaShellBoardBridge } from './moaShellBoardBridge';
import { buildBoardNavigatePath } from './moaShellBoardNavigate';
import { safeTryHandleBoardShellNavigate } from './safeShellBoardNavigate';

type RouterLike = {
  navigate: (path: string) => void;
  __moabomBoardNavPatched?: boolean;
};

type G7CoreLike = {
  updateQueryParams?: (newPath: string, options?: { transitionOverlayTarget?: string }) => Promise<void>;
  dispatch?: (action: {
    handler?: string;
    params?: {
      path?: string;
      mergeQuery?: boolean;
      query?: Record<string, unknown>;
    };
  }) => unknown;
  __moabomBoardUpdateQueryPatched?: boolean;
  __moabomDispatchNavPatched?: boolean;
};

let originalNavigate: ((path: string) => void) | null = null;
let originalUpdateQueryParams: ((newPath: string, options?: { transitionOverlayTarget?: string }) => Promise<void>) | null = null;
let originalDispatch: ((action: {
  handler?: string;
  params?: {
    path?: string;
    mergeQuery?: boolean;
    query?: Record<string, unknown>;
  };
}) => unknown) | null = null;

export function installMoaShellBoardNavigateBridge(): void {
  if (typeof window === 'undefined') return;

  const router = (window as { __templateApp?: { getRouter?: () => RouterLike | null } })
    .__templateApp?.getRouter?.();
  if (router && !router.__moabomBoardNavPatched) {
    originalNavigate = router.navigate.bind(router);
    router.navigate = (path: string) => {
      const bridge = getMoaShellBoardBridge();
      if (bridge && safeTryHandleBoardShellNavigate(path, bridge)) {
        return;
      }
      originalNavigate?.(path);
    };
    router.__moabomBoardNavPatched = true;
  }

  const G7Core = (window as { G7Core?: G7CoreLike }).G7Core;
  if (G7Core?.updateQueryParams && !G7Core.__moabomBoardUpdateQueryPatched) {
    originalUpdateQueryParams = G7Core.updateQueryParams.bind(G7Core);
    G7Core.updateQueryParams = async (newPath: string, options?: { transitionOverlayTarget?: string }) => {
      const bridge = getMoaShellBoardBridge();
      if (bridge && safeTryHandleBoardShellNavigate(newPath, bridge, { replace: true })) {
        return;
      }
      return originalUpdateQueryParams?.(newPath, options);
    };
    G7Core.__moabomBoardUpdateQueryPatched = true;
  }

  if (G7Core?.dispatch && !G7Core.__moabomDispatchNavPatched) {
    originalDispatch = G7Core.dispatch.bind(G7Core);
    G7Core.dispatch = (action) => {
      if (action?.handler === 'navigate') {
        const params = action.params ?? {};
        const rawPath = typeof params.path === 'string' ? params.path : '';
        if (rawPath) {
          const path = buildBoardNavigatePath(rawPath, params);
          const bridge = getMoaShellBoardBridge();
          if (bridge && safeTryHandleBoardShellNavigate(path, bridge)) {
            return;
          }
        }
      }
      return originalDispatch?.(action);
    };
    G7Core.__moabomDispatchNavPatched = true;
  }
}

export function uninstallMoaShellBoardNavigateBridge(): void {
  if (typeof window === 'undefined') return;

  const router = (window as { __templateApp?: { getRouter?: () => RouterLike | null } })
    .__templateApp?.getRouter?.();
  if (router?.__moabomBoardNavPatched && originalNavigate) {
    router.navigate = originalNavigate;
    delete router.__moabomBoardNavPatched;
    originalNavigate = null;
  }

  const G7Core = (window as { G7Core?: G7CoreLike }).G7Core;
  if (G7Core?.__moabomBoardUpdateQueryPatched && originalUpdateQueryParams) {
    G7Core.updateQueryParams = originalUpdateQueryParams;
    delete G7Core.__moabomBoardUpdateQueryPatched;
    originalUpdateQueryParams = null;
  }

  if (G7Core?.__moabomDispatchNavPatched && originalDispatch) {
    G7Core.dispatch = originalDispatch;
    delete G7Core.__moabomDispatchNavPatched;
    originalDispatch = null;
  }
}
