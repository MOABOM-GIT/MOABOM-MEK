import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensureMoabomShellAuthPreloaded,
  resetMoabomShellAuthPreloadForTest,
} from './moabomShellAuthPreload';

describe('ensureMoabomShellAuthPreloaded', () => {
  beforeEach(() => {
    resetMoabomShellAuthPreloadForTest();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetMoabomShellAuthPreloadForTest();
  });

  it('토큰 없으면 preloadAuth 를 호출하지 않는다', async () => {
    const preloadAuth = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
    });
    (window as { G7Core?: unknown }).G7Core = {
      AuthManager: {
        getInstance: () => ({
          isAuthenticated: () => false,
          getUser: () => null,
          preloadAuth,
        }),
      },
    };

    await ensureMoabomShellAuthPreloaded();

    expect(preloadAuth).not.toHaveBeenCalled();
  });
});
