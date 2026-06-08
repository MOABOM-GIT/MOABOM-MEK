import { describe, expect, it } from 'vitest';
import { APPS } from '../../data/Moa_apps';
import { buildMainApps, buildRecentApps, normalizeTaskbarItems } from './moaHomeAppLists';

describe('moaHomeAppLists', () => {
  it('buildMainApps returns all apps when order is empty', () => {
    expect(buildMainApps([])).toEqual([...APPS]);
  });

  it('buildMainApps respects custom order', () => {
    const ids = ['weather', 'mypage'];
    const apps = buildMainApps(ids);
    expect(apps.map(a => a.id)).toEqual(ids);
  });

  it('buildRecentApps skips mypage and caps length', () => {
    const ids = ['mypage', 'weather', 'brain-gen', 'decision', 'community', 'task1', 'task2', 'task3', 'color-tool', 'qr-tool'];
    const recent = buildRecentApps(ids);
    expect(recent.some(a => a.id === 'mypage')).toBe(false);
    expect(recent.length).toBeLessThanOrEqual(9);
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
