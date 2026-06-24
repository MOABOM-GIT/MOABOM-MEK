import { beforeEach, describe, expect, it } from 'vitest';
import {
  addMainUnpinnedGeneratedId,
  filterOrderExcludingUnpinned,
  loadMainUnpinnedGeneratedIds,
  mergeMainUnpinnedFromPull,
  removeMainUnpinnedGeneratedId,
  resolveMainUnpinnedScopeKey,
  setActiveMainUnpinnedScopeKey,
  STORAGE_KEY_MAIN_UNPINNED_GENERATED,
} from './moaShellMainAppUnpinned';
import { resolveMainAppsFromOrder } from './moaShellAppOrder';

describe('moaShellMainAppUnpinned', () => {
  beforeEach(() => {
    localStorage.clear();
    setActiveMainUnpinnedScopeKey('guest');
  });

  it('persists unpinned generated app ids per scope', () => {
    setActiveMainUnpinnedScopeKey('member:user-1');
    addMainUnpinnedGeneratedId('generated-app-42');
    expect([...loadMainUnpinnedGeneratedIds('member:user-1')]).toEqual(['generated-app-42']);
    expect(loadMainUnpinnedGeneratedIds('guest').size).toBe(0);

    removeMainUnpinnedGeneratedId('generated-app-42');
    expect(loadMainUnpinnedGeneratedIds('member:user-1').size).toBe(0);
  });

  it('migrates legacy flat storage into guest scope', () => {
    localStorage.setItem(STORAGE_KEY_MAIN_UNPINNED_GENERATED, '["generated-app-9"]');
    expect([...loadMainUnpinnedGeneratedIds('guest')]).toEqual(['generated-app-9']);
    expect(localStorage.getItem(STORAGE_KEY_MAIN_UNPINNED_GENERATED)).toBeNull();
  });

  it('guest unpinned does not hide member main order after scope switch', () => {
    setActiveMainUnpinnedScopeKey('guest');
    addMainUnpinnedGeneratedId('generated-app-7');

    setActiveMainUnpinnedScopeKey(resolveMainUnpinnedScopeKey(true, 'member-1'));

    const owned = {
      id: 'generated-app-7',
      name: 'AI 앱',
      description: '저장됨',
      icon: 'sparkles',
      gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
      category: 'user' as const,
      source: 'user-created' as const,
    };

    expect(resolveMainAppsFromOrder(
      ['hospital-info', 'generated-app-7'],
      [owned],
      [],
      true,
      loadMainUnpinnedGeneratedIds('member:member-1'),
    ).map(app => app.id)).toEqual(['hospital-info', 'generated-app-7']);
  });

  it('mergeMainUnpinnedFromPull keeps local unpinned when server field is absent', () => {
    expect(mergeMainUnpinnedFromPull({
      isLoggedIn: true,
      trustLocalDuringCooldown: false,
      localUnpinned: ['generated-app-7'],
      serverUnpinned: null,
    })).toEqual(['generated-app-7']);
  });

  it('mergeMainUnpinnedFromPull prefers server unpinned for logged-in users', () => {
    expect(mergeMainUnpinnedFromPull({
      isLoggedIn: true,
      trustLocalDuringCooldown: false,
      localUnpinned: ['generated-app-1'],
      serverUnpinned: ['generated-app-2'],
    })).toEqual(['generated-app-2']);
  });

  it('filterOrderExcludingUnpinned removes blocked ids', () => {
    const unpinned = new Set(['generated-app-2']);
    expect(filterOrderExcludingUnpinned(
      ['cpap-mask', 'generated-app-2', 'generated-app-1'],
      unpinned,
    )).toEqual(['cpap-mask', 'generated-app-1']);
  });

  it('resolveMainAppsFromOrder hides unpinned generated apps after main removal', () => {
    const owned = {
      id: 'generated-app-7',
      name: 'AI 앱',
      description: '저장됨',
      icon: 'sparkles',
      gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
      category: 'user' as const,
      source: 'user-created' as const,
    };

    addMainUnpinnedGeneratedId('generated-app-7');

    expect(resolveMainAppsFromOrder(
      ['hospital-info', 'generated-app-7'],
      [owned],
      [],
      true,
      loadMainUnpinnedGeneratedIds(),
    ).map(app => app.id)).toEqual(['hospital-info']);

    expect(resolveMainAppsFromOrder(
      [],
      [owned],
      [],
      false,
      loadMainUnpinnedGeneratedIds(),
    ).map(app => app.id)).not.toContain('generated-app-7');
  });
});
