import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from '../data/Moa_apps';
import * as moabomTranslationOverlay from './moabomTranslationOverlay';
import { resolveAppStrings, resolveAuthWindowTitle, resolveWindowTitle } from './resolveAppStrings';

const baseApp: App = {
  id: 'test-app',
  name: '원문이름',
  description: '원문설명',
  icon: 'star',
  gradient: 'linear-gradient(135deg,#000,#fff)',
  category: 'basic',
  source: 'system',
};

describe('resolveAppStrings', () => {
  beforeEach(() => {
    moabomTranslationOverlay.clearMoabomTranslationOverlay();
    moabomTranslationOverlay.clearShellUiTranslationLocaleHint();
  });

  it('활성 로케일의 i18n 항목을 최우선으로 사용한다', () => {
    const app: App = {
      ...baseApp,
      i18n: {
        en: { name: 'API Name', description: 'API Desc' },
      },
    };
    const t = (key: string) => key;
    expect(resolveAppStrings(app, 'en')).toEqual({
      name: 'API Name',
      description: 'API Desc',
    });
  });

  it('API 문자열이 없고 오버레이가 동기화되어 있으면 템플릿 번역 키를 사용한다', () => {
    const lookupSpy = vi.spyOn(moabomTranslationOverlay, 'lookupMoabomOverlay').mockImplementation((key: string) =>
      key === 'moa_apps.test-app.name'
        ? 'Tpl Name'
        : key === 'moa_apps.test-app.description'
          ? 'Tpl Desc'
          : undefined,
    );
    const syncSpy = vi.spyOn(moabomTranslationOverlay, 'isMoabomOverlaySyncedToLocale').mockReturnValue(true);
    const app = { ...baseApp };
    const t = (key: string) => key;
    expect(resolveAppStrings(app, 'en')).toEqual({
      name: 'Tpl Name',
      description: 'Tpl Desc',
    });
    lookupSpy.mockRestore();
    syncSpy.mockRestore();
  });

  it('번역 키도 없으면 app.name · app.description 으로 폴백한다', () => {
    const app = { ...baseApp };
    const t = (key: string) => key;
    expect(resolveAppStrings(app, 'en')).toEqual({
      name: '원문이름',
      description: '원문설명',
    });
  });

  it('API 이름이 공백만이면 이름은 템플릿·원문 순으로 폴백하고 설명은 API 값을 유지한다', () => {
    const lookupSpy = vi
      .spyOn(moabomTranslationOverlay, 'lookupMoabomOverlay')
      .mockImplementation((key: string) => (key === 'moa_apps.test-app.name' ? 'Tpl' : undefined));
    const syncSpy = vi.spyOn(moabomTranslationOverlay, 'isMoabomOverlaySyncedToLocale').mockReturnValue(true);
    const app: App = {
      ...baseApp,
      i18n: { en: { name: '   ', description: 'Only Desc' } },
    };
    const t = (key: string) => key;
    const resolved = resolveAppStrings(app, 'en');
    expect(resolved.name).toBe('Tpl');
    expect(resolved.description).toBe('Only Desc');
    lookupSpy.mockRestore();
    syncSpy.mockRestore();
  });

  it('오버레이 활성인데 moa_apps 키가 없으면 코어 t를 거치지 않고 원문으로 폴백한다', () => {
    const lookupSpy = vi.spyOn(moabomTranslationOverlay, 'lookupMoabomOverlay').mockReturnValue(undefined);
    const syncSpy = vi.spyOn(moabomTranslationOverlay, 'isMoabomOverlaySyncedToLocale').mockReturnValue(true);
    const app = { ...baseApp };
    const t = vi.fn(() => 'EnglishFromCore');

    expect(resolveAppStrings(app, 'ko')).toEqual({
      name: '원문이름',
      description: '원문설명',
    });
    expect(t).not.toHaveBeenCalled();

    lookupSpy.mockRestore();
    syncSpy.mockRestore();
  });

  it('오버레이에 moa_apps 값이 있으면 그 문자열을 사용한다', () => {
    const lookupSpy = vi
      .spyOn(moabomTranslationOverlay, 'lookupMoabomOverlay')
      .mockImplementation((key: string) =>
        key === 'moa_apps.test-app.name'
          ? '오버레이이름'
          : key === 'moa_apps.test-app.description'
            ? '오버레이설명'
            : undefined,
      );
    const syncSpy = vi.spyOn(moabomTranslationOverlay, 'isMoabomOverlaySyncedToLocale').mockReturnValue(true);
    const app = { ...baseApp };
    const t = vi.fn(() => 'ShouldNotUse');

    expect(resolveAppStrings(app, 'ko')).toEqual({
      name: '오버레이이름',
      description: '오버레이설명',
    });
    expect(t).not.toHaveBeenCalled();

    lookupSpy.mockRestore();
    syncSpy.mockRestore();
  });

  it('오버레이가 요청 로케일과 동기화되지 않았으면 metadata로 폴백한다', () => {
    const syncSpy = vi.spyOn(moabomTranslationOverlay, 'isMoabomOverlaySyncedToLocale').mockReturnValue(false);
    const app = { ...baseApp };
    const t = vi.fn(() => 'EnglishFromCore');

    expect(resolveAppStrings(app, 'ko')).toEqual({
      name: '원문이름',
      description: '원문설명',
    });
    expect(t).not.toHaveBeenCalled();
    syncSpy.mockRestore();
  });
});

describe('resolveAuthWindowTitle', () => {
  it('알려진 인증 창 id는 번역 키로 치환한다', () => {
    const t = (key: string) => (key === 'moa_shell.auth_windows.login' ? 'Sign in' : key);
    expect(resolveAuthWindowTitle('login', t)).toBe('Sign in');
  });

  it('미등록 id는 그대로 반환한다', () => {
    const t = (key: string) => key;
    expect(resolveAuthWindowTitle('unknown', t)).toBe('unknown');
  });
});

describe('resolveWindowTitle', () => {
  const appsById = new Map<string, App>([['test-app', baseApp]]);
  const authIds = ['login'];

  it('인증 창은 resolveAuthWindowTitle 경로를 탄다', () => {
    const t = (key: string) => (key === 'moa_shell.auth_windows.login' ? 'Sign in' : key);
    expect(resolveWindowTitle({ appId: 'login', title: 'x' }, appsById, 'en', t, authIds)).toBe('Sign in');
  });

  it('일반 앱은 resolveAppStrings 이름을 사용한다', () => {
    const lookupSpy = vi
      .spyOn(moabomTranslationOverlay, 'lookupMoabomOverlay')
      .mockImplementation((key: string) => (key === 'moa_apps.test-app.name' ? 'Shown' : undefined));
    const syncSpy = vi.spyOn(moabomTranslationOverlay, 'isMoabomOverlaySyncedToLocale').mockReturnValue(true);
    const t = (key: string) => (key === 'moa_apps.test-app.name' ? 'Shown' : key);
    expect(resolveWindowTitle({ appId: 'test-app', title: 'old' }, appsById, 'en', t, authIds)).toBe('Shown');
    lookupSpy.mockRestore();
    syncSpy.mockRestore();
  });

  it('카탈로그에 없는 앱은 win.title 을 유지한다', () => {
    const t = (key: string) => key;
    expect(resolveWindowTitle({ appId: 'missing', title: 'Fallback' }, appsById, 'en', t, [])).toBe('Fallback');
  });
});
