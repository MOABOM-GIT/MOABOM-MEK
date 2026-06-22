import { describe, expect, it } from 'vitest';
import { createAppShellMetadata } from '../apps/ai-generator/metadata';
import { APPS } from '../data/Moa_apps';
import { buildMainApps, buildMyApps, buildRecentApps, dedupeAppsById, mainPanelGeneratedExtras, normalizeTaskbarItems } from './moaShellAppLists';

describe('moaShellAppLists', () => {
  it('buildMainApps returns all apps when order is empty and not customized', () => {
    const apps = buildMainApps([]);
    expect(apps.map(a => a.id)).toContain('hospital-info');
    expect(apps).toEqual([createAppShellMetadata, ...APPS]);
  });

  it('buildMainApps returns empty grid when customized with empty order', () => {
    expect(buildMainApps([], [], { customized: true })).toEqual([]);
  });

  it('buildMainApps requires explicit customized flag for filtered order', () => {
    expect(buildMainApps(['cpap-mask'], [], {}).map(app => app.id)).toEqual([
      createAppShellMetadata.id,
      ...APPS.map(app => app.id),
    ]);
    expect(buildMainApps(['cpap-mask'], [], { customized: true }).map(app => app.id)).toEqual(['cpap-mask']);
  });

  it('buildMainApps respects saved order without forcing hospital-info', () => {
    const ids = ['cpap-mask', 'mypage'];
    const apps = buildMainApps(ids, [], { customized: true });
    expect(apps.map(a => a.id)).toEqual(['cpap-mask', 'mypage']);
  });

  it('buildMyApps always exposes create-app first', () => {
    const generated = {
      id: 'generated-app-42',
      name: 'AI 저장 앱',
      description: '저장됨',
      icon: 'magic',
      gradient: 'linear-gradient(#000,#111)',
      category: 'user' as const,
      source: 'user-created' as const,
    };

    expect(buildMyApps([generated]).map(app => app.id)).toEqual(['create-app', 'generated-app-42']);
    expect(buildMyApps([]).map(app => app.id)).toEqual(['create-app']);
  });

  it('buildRecentApps skips mypage and caps length', () => {
    const ids = ['mypage', 'cpap-mask', 'consulting', 'hospital-info'];
    const recent = buildRecentApps(ids);
    expect(recent.some(a => a.id === 'mypage')).toBe(false);
    expect(recent.map(app => app.id)).toEqual(['cpap-mask', 'consulting', 'hospital-info']);
  });

  it('mainPanelGeneratedExtras omits catalog apps unless pinned in customized order', () => {
    const owned = {
      id: 'generated-app-1',
      name: 'Owned',
      description: '',
      icon: 'magic',
      gradient: 'linear-gradient(#000,#111)',
      category: 'user' as const,
      source: 'user-created' as const,
    };
    const catalog = {
      id: 'generated-app-99',
      name: 'Global catalog',
      description: '',
      icon: 'magic',
      gradient: 'linear-gradient(#000,#111)',
      category: 'user' as const,
      source: 'user-created' as const,
      metadata: { isShared: true },
    };
    const unpinned = new Set(['generated-app-1']);

    expect(mainPanelGeneratedExtras([], [owned], [catalog], false)).toEqual([owned]);
    expect(mainPanelGeneratedExtras([], [owned], [catalog], false, unpinned)).toEqual([]);
    expect(mainPanelGeneratedExtras([], [owned], [catalog], true)).toEqual([]);
    expect(mainPanelGeneratedExtras(['generated-app-99'], [owned], [catalog], true)).toEqual([catalog]);
    expect(mainPanelGeneratedExtras(['generated-app-1'], [owned], [catalog], true)).toEqual([owned]);
    expect(mainPanelGeneratedExtras(['generated-app-1'], [owned], [catalog], true, unpinned)).toEqual([]);
  });

  it('buildMainApps does not auto-include global catalog apps when order is empty and not customized', () => {
    const catalog = {
      id: 'generated-app-99',
      name: 'Global catalog',
      description: '',
      icon: 'magic',
      gradient: 'linear-gradient(#000,#111)',
      category: 'user' as const,
      source: 'user-created' as const,
      metadata: { isShared: true },
    };

    const apps = buildMainApps([], mainPanelGeneratedExtras([], [], [catalog], false));
    expect(apps.some(app => app.id === 'generated-app-99')).toBe(false);
  });

  it('dedupeAppsById keeps the first occurrence per id', () => {
    const owned = {
      id: 'generated-app-1',
      name: 'Owned',
      description: '',
      icon: 'magic',
      gradient: 'linear-gradient(#000,#111)',
      category: 'user' as const,
      source: 'user-created' as const,
      metadata: { isShared: true },
    };
    const shared = {
      ...owned,
      name: 'Shared copy',
      metadata: { isShared: true },
    };

    expect(dedupeAppsById([owned, shared])).toEqual([owned]);
  });

  it('buildMainApps can include saved generated apps from server when pinned in order', () => {
    const generated = {
      id: 'generated-app-42',
      name: 'AI 저장 앱',
      description: '저장됨',
      icon: 'magic',
      gradient: 'linear-gradient(#000,#111)',
      category: 'user' as const,
      source: 'user-created' as const,
    };

    expect(
      buildMainApps(
        ['generated-app-42'],
        mainPanelGeneratedExtras(['generated-app-42'], [generated], [], true),
        { customized: true },
      ).map(app => app.id),
    ).toEqual(['generated-app-42']);
    expect(buildRecentApps(['generated-app-42'], [generated])).toEqual([generated]);
  });

  it('normalizeTaskbarItems maps legacy ai-generator id to create-app', () => {
    const items = normalizeTaskbarItems([{
      id: 'win-1',
      appId: 'ai-generator',
      title: 'AI',
      icon: 'magic',
      gradient: 'linear-gradient(#000,#111)',
    }]);
    expect(items[0]?.appId).toBe('create-app');
  });
});
