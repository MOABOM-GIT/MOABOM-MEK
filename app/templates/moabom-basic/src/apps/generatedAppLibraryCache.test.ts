import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearGeneratedAppLibraryCache,
  loadCachedGeneratedLibraryApps,
  saveGeneratedAppLibraryCache,
} from './generatedAppLibraryCache';

describe('generatedAppLibraryCache', () => {
  beforeEach(() => {
    clearGeneratedAppLibraryCache();
  });

  it('loadCachedGeneratedLibraryApps returns empty when scope mismatches', () => {
    saveGeneratedAppLibraryCache(
      [{ id: 1, title: 'One', app_type: 'general' }],
      [],
      'member:a',
    );

    expect(loadCachedGeneratedLibraryApps('member:b').owned).toEqual([]);
    expect(loadCachedGeneratedLibraryApps('member:a').owned.map(app => app.id)).toEqual(['generated-app-1']);
  });

  it('clearGeneratedAppLibraryCache removes v1 and v2 keys', () => {
    saveGeneratedAppLibraryCache([], [], 'guest');
    localStorage.setItem('moabom-generated-app-library-v1', '{}');

    clearGeneratedAppLibraryCache();

    expect(localStorage.getItem('moabom-generated-app-library-v2')).toBeNull();
    expect(localStorage.getItem('moabom-generated-app-library-v1')).toBeNull();
  });
});
