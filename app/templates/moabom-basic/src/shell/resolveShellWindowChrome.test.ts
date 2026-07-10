import { describe, expect, it } from 'vitest';
import type { WindowState } from '../components/composite/Moa_CenterPanel';
import type { App } from '../data/Moa_apps';
import { createAppShellMetadata } from '../apps/ai-generator/metadata';
import { WEBSITE_LINK_APP_GRADIENT } from '../apps/ai-generator/websiteLinkApp';
import { MOA_SHELL_POINT_TITLE_GRADIENT } from './moaShellLayoutConstants';
import { resolveShellWindowChrome } from './resolveShellWindowChrome';

function seedWin(partial: Partial<WindowState> & Pick<WindowState, 'appId'>): WindowState {
  return {
    id: `${partial.appId}-1`,
    title: 'seed-title',
    icon: 'seed-icon',
    gradient: 'linear-gradient(135deg,#111,#222)',
    zIndex: 1,
    isMaximized: false,
    isMinimized: false,
    ...partial,
  };
}

describe('resolveShellWindowChrome', () => {
  it('prefers catalog chrome for generated apps over WindowState seed', () => {
    const catalogApp: App = {
      id: 'generated-app-9',
      name: '마이숨',
      description: '',
      icon: 'link',
      iconImageUrl: '/api/modules/moabom-apps/apps/generated/9/website-icon?icon_token=x',
      gradient: WEBSITE_LINK_APP_GRADIENT,
      category: 'user',
      source: 'user-created',
    };
    const appsById = new Map<string, App>([[catalogApp.id, catalogApp]]);
    const chrome = resolveShellWindowChrome(
      seedWin({ appId: 'generated-app-9', title: 'stale', icon: 'cube', gradient: 'linear-gradient(135deg,#f00,#0f0)' }),
      appsById,
      'ko',
    );

    expect(chrome.title).toBe('마이숨');
    expect(chrome.icon).toBe('link');
    expect(chrome.gradient).toBe(WEBSITE_LINK_APP_GRADIENT);
    expect(chrome.iconImageUrl).toContain('website-icon');
  });

  it('keeps seed chrome when generated catalog miss', () => {
    const win = seedWin({ appId: 'generated-app-3', title: 'pending', icon: 'cube' });
    const chrome = resolveShellWindowChrome(win, new Map(), 'ko');
    expect(chrome).toEqual({
      title: 'pending',
      icon: 'cube',
      gradient: win.gradient,
    });
  });

  it('uses create-app and mypage fixed chrome', () => {
    expect(resolveShellWindowChrome(
      seedWin({ appId: createAppShellMetadata.id }),
      new Map(),
      'ko',
    )).toMatchObject({
      icon: createAppShellMetadata.icon,
      gradient: createAppShellMetadata.gradient,
    });

    expect(resolveShellWindowChrome(
      seedWin({ appId: 'mypage' }),
      new Map(),
      'ko',
    ).gradient).toBe(MOA_SHELL_POINT_TITLE_GRADIENT);
  });
});
