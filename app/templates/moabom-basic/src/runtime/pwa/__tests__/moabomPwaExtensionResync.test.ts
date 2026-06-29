import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  G7_CACHE_VERSION_STORAGE_KEY,
  MOABOM_PWA_EXTENSION_RESYNC_KEY,
  markMoabomPwaExtensionResync,
  resetMoabomPwaExtensionResyncForTest,
  runMoabomPwaExtensionResyncIfMarked,
} from '../moabomPwaExtensionResync';

vi.mock('../../moabomShellBoot', () => ({
  invalidateMoabomShellBootCache: vi.fn(),
  ensureMoabomShellBootLoaded: vi.fn().mockResolvedValue(null),
}));

describe('moabomPwaExtensionResync', () => {
  beforeEach(() => {
    resetMoabomPwaExtensionResyncForTest();
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    resetMoabomPwaExtensionResyncForTest();
    delete (window as { __templateApp?: unknown }).__templateApp;
  });

  it('markMoabomPwaExtensionResync 는 플래그를 세우고 g7_cache_version 을 제거한다', () => {
    localStorage.setItem(G7_CACHE_VERSION_STORAGE_KEY, '12345');

    markMoabomPwaExtensionResync();

    expect(sessionStorage.getItem(MOABOM_PWA_EXTENSION_RESYNC_KEY)).toBe('1');
    expect(localStorage.getItem(G7_CACHE_VERSION_STORAGE_KEY)).toBeNull();
  });

  it('플래그가 없으면 resync 를 건너뛴다', async () => {
    const result = await runMoabomPwaExtensionResyncIfMarked();
    expect(result).toBe(false);
  });

  it('플래그가 있으면 reloadExtensionState 후 현재 경로로 navigate 한다', async () => {
    const reloadExtensionState = vi.fn().mockResolvedValue(undefined);
    const navigate = vi.fn();

    (window as { __templateApp?: unknown }).__templateApp = {
      reloadExtensionState,
      getRouter: () => ({ navigate }),
    };

    markMoabomPwaExtensionResync();

    const result = await runMoabomPwaExtensionResyncIfMarked();

    expect(result).toBe(true);
    expect(sessionStorage.getItem(MOABOM_PWA_EXTENSION_RESYNC_KEY)).toBeNull();
    expect(reloadExtensionState).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(`${window.location.pathname}${window.location.search}`);
  });
});
