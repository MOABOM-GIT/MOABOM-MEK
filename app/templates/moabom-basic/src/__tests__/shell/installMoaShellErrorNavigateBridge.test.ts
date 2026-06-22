import { afterEach, describe, expect, it, vi } from 'vitest';
import { installMoaShellErrorPageHandlerBridge } from '../../shell/installMoaShellErrorNavigateBridge';

describe('installMoaShellErrorPageHandlerBridge', () => {
  afterEach(() => {
    delete (window as { __templateApp?: unknown }).__templateApp;
    delete (window as { __moabomShellHomeMounted?: boolean }).__moabomShellHomeMounted;
    delete (window as { __moabomErrorShellRecovering?: boolean }).__moabomErrorShellRecovering;
    delete (window as { __moabomPendingShellError?: unknown }).__moabomPendingShellError;
    vi.restoreAllMocks();
  });

  it('부트 전 routeNotFound 시 home(/) 로 복구하고 풀스크린 renderError 를 생략한다', async () => {
    const originalRenderError = vi.fn().mockResolvedValue(false);
    const navigateToCurrentPath = vi.fn().mockResolvedValue(undefined);

    (window as { __templateApp?: unknown }).__templateApp = {
      getErrorPageHandler: () => ({
        renderError: originalRenderError,
      }),
      getRouter: () => ({
        navigateToCurrentPath,
      }),
    };

    expect(installMoaShellErrorPageHandlerBridge()).toBe(true);

    const handler = (window as {
      __templateApp?: { getErrorPageHandler?: () => { renderError: (c: number) => Promise<boolean> } };
    }).__templateApp?.getErrorPageHandler?.();

    const rendered = await handler?.renderError(404, 'app');

    expect(rendered).toBe(true);
    expect(originalRenderError).not.toHaveBeenCalled();
    expect(navigateToCurrentPath).toHaveBeenCalledTimes(1);
    expect((window as { __moabomPendingShellError?: number }).__moabomPendingShellError).toBe(404);
  });
});
