import { describe, expect, it } from 'vitest';
import {
  commitSavedGeneratedAppToLibrary,
  reconcileGeneratedLibraryFromServer,
  resolveGeneratedLibraryScopeKey,
} from './generatedAppLibraryAuthority';
import { loadGeneratedAppLibraryCache } from './generatedAppLibraryCache';

describe('generatedAppLibraryAuthority', () => {
  it('resolveGeneratedLibraryScopeKey scopes by member or guest', () => {
    expect(resolveGeneratedLibraryScopeKey(true, 'u-42')).toBe('member:u-42');
    expect(resolveGeneratedLibraryScopeKey(false, 'u-42')).toBe('guest');
    expect(resolveGeneratedLibraryScopeKey(true, undefined)).toBe('guest');
  });

  it('reconcileGeneratedLibraryFromServer maps API items and writes scoped cache', () => {
    const result = reconcileGeneratedLibraryFromServer({
      ownedItems: [{ id: 3, title: 'Mine', app_type: 'general' }],
      sharedItems: [{ id: 9, title: 'Shared', app_type: 'game', is_shared: true }],
      scopeKey: 'member:test',
    });

    expect(result.owned.map(app => app.id)).toEqual(['generated-app-3']);
    expect(result.shared.map(app => app.id)).toEqual(['generated-app-9']);
    expect(result.library.map(app => app.id)).toEqual(['generated-app-3', 'generated-app-9']);

    const cached = loadGeneratedAppLibraryCache();
    expect(cached?.scopeKey).toBe('member:test');
    expect(cached?.owned[0]?.id).toBe(3);
  });

  it('commitSavedGeneratedAppToLibrary upserts a server-confirmed owned app', () => {
    reconcileGeneratedLibraryFromServer({
      ownedItems: [{ id: 1, title: 'Old', app_type: 'general' }],
      sharedItems: [],
      scopeKey: 'member:test',
    });

    const app = commitSavedGeneratedAppToLibrary(
      { id: 2, title: 'Saved', app_type: 'dataviz' },
      'member:test',
    );

    expect(app.id).toBe('generated-app-2');
    expect(app.name).toBe('Saved');

    const cached = loadGeneratedAppLibraryCache();
    expect(cached?.owned.map(item => item.id)).toEqual([2, 1]);
  });
});
