import { beforeEach, describe, expect, it } from 'vitest';
import {
  addMainUnpinnedGeneratedId,
  filterOrderExcludingUnpinned,
  loadMainUnpinnedGeneratedIds,
  removeMainUnpinnedGeneratedId,
  STORAGE_KEY_MAIN_UNPINNED_GENERATED,
} from './moaShellMainAppUnpinned';
import { resolveMainAppsFromOrder } from './moaShellAppOrder';

describe('moaShellMainAppUnpinned', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists unpinned generated app ids', () => {
    addMainUnpinnedGeneratedId('generated-app-42');
    expect([...loadMainUnpinnedGeneratedIds()]).toEqual(['generated-app-42']);
    removeMainUnpinnedGeneratedId('generated-app-42');
    expect(loadMainUnpinnedGeneratedIds().size).toBe(0);
    expect(localStorage.getItem(STORAGE_KEY_MAIN_UNPINNED_GENERATED)).toBe('[]');
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
