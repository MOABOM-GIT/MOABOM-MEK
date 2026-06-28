import { getMoaShellBoardBridge } from './moaShellBoardBridge';
import { safeTryHandleBoardShellNavigate } from './safeShellBoardNavigate';

type RouterLike = {
  navigate: (path: string) => void;
  __moabomBoardNavPatched?: boolean;
};

type G7CoreLike = {
  updateQueryParams?: (newPath: string, options?: { transitionOverlayTarget?: string }) => Promise<void>;
  __moabomBoardUpdateQueryPatched?: boolean;
};

let originalNavigate: ((path: string) => void) | null = null;
let originalUpdateQueryParams: ((newPath: string, options?: { transitionOverlayTarget?: string }) => Promise<void>) | null = null;

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
}
