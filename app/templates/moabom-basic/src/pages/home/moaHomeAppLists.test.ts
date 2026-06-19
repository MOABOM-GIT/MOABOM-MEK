import { describe, expect, it } from 'vitest';
import { createAppShellMetadata } from '../../apps/ai-generator/metadata';
import { APPS } from '../../data/Moa_apps';
import { buildMainApps, buildMyApps, buildRecentApps, dedupeAppsById, normalizeTaskbarItems } from './moaHomeAppLists';

describe('moaHomeAppLists', () => {
  it('buildMainApps returns all apps when order is empty', () => {
    expect(buildMainApps([])).toEqual([createAppShellMetadata, ...APPS]);
  });

  it('buildMainApps inserts hospital info before mypage for saved orders', () => {
    const ids = ['cpap-mask', 'mypage'];
    const apps = buildMainApps(ids);
    expect(apps.map(a => a.id)).toEqual(['cpap-mask', 'hospital-info', 'mypage']);
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

  it('buildMainApps can include saved generated apps from server', () => {
    const generated = {
      id: 'generated-app-42',
      name: 'AI 저장 앱',
      description: '저장됨',
      icon: 'magic',
      gradient: 'linear-gradient(#000,#111)',
      category: 'user' as const,
      source: 'user-created' as const,
    };

    expect(buildMainApps(['generated-app-42'], [generated]).map(app => app.id)).toEqual([
      'hospital-info',
      'generated-app-42',
    ]);
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
