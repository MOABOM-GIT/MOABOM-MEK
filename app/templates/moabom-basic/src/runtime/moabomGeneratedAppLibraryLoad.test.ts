import { describe, expect, it, beforeEach } from 'vitest';
import {
  normalizeMoabomGeneratedAppLibraryPayload,
  seedMoabomGeneratedAppLibrary,
  __resetMoabomGeneratedAppLibraryLoadForTest,
  loadMoabomGeneratedAppLibrary,
} from './moabomGeneratedAppLibraryLoad';

describe('moabomGeneratedAppLibraryLoad', () => {
  beforeEach(() => {
    __resetMoabomGeneratedAppLibraryLoadForTest();
  });

  it('normalizeMoabomGeneratedAppLibraryPayload rejects invalid shapes', () => {
    expect(normalizeMoabomGeneratedAppLibraryPayload(null)).toBeNull();
    expect(normalizeMoabomGeneratedAppLibraryPayload({ owned: [] })).toBeNull();
  });

  it('seedMoabomGeneratedAppLibrary makes loadMoabomGeneratedAppLibrary resolve without fetch', async () => {
    seedMoabomGeneratedAppLibrary({
      owned: [{ id: 1, title: 'One', app_type: 'general' }],
      shared: [],
    });

    const library = await loadMoabomGeneratedAppLibrary(true);
    expect(library.owned.map(item => item.id)).toEqual([1]);
    expect(library.shared).toEqual([]);
  });
});
