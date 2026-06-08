import { describe, expect, it } from 'vitest';
import { formatShellPath, parseShellPathname, parseShellRoute } from './moabomShellRoutes';

describe('moabomShellRoutes', () => {
  it('홈 경로를 파싱한다', () => {
    expect(parseShellPathname('/')).toEqual({ kind: 'home' });
    expect(parseShellPathname('')).toEqual({ kind: 'home' });
    expect(parseShellPathname('//')).toEqual({ kind: 'home' });
  });

  it('인증 경로를 파싱한다', () => {
    expect(parseShellPathname('/auth/login')).toEqual({ kind: 'auth', mode: 'login' });
    expect(parseShellPathname('/auth/forgot-password')).toEqual({ kind: 'auth', mode: 'forgot-password' });
  });

  it('마이페이지 경로를 파싱한다', () => {
    expect(parseShellPathname('/me')).toEqual({ kind: 'me', tab: 'profile' });
    expect(parseShellPathname('/me/settings')).toEqual({ kind: 'me', tab: 'settings' });
  });

  it('/app/mypage 는 /me 와 동일하게 프로필로 정규화한다', () => {
    expect(parseShellPathname('/app/mypage')).toEqual({ kind: 'me', tab: 'profile' });
  });

  it('앱 경로를 파싱한다', () => {
    const r = parseShellPathname('/app/weather');
    expect(r).toEqual({ kind: 'app', appId: 'weather' });
  });

  it('create-app 편집 쿼리를 파싱한다', () => {
    expect(parseShellRoute('/app/create-app', '?edit=42')).toEqual({
      kind: 'app',
      appId: 'create-app',
      editGeneratedAppId: 42,
    });
    expect(formatShellPath({ kind: 'app', appId: 'create-app', editGeneratedAppId: 42 }))
      .toBe('/app/create-app?edit=42');
  });

  it('저장 AI 앱 id 경로를 파싱한다', () => {
    expect(parseShellPathname('/app/generated-app-42')).toEqual({ kind: 'app', appId: 'generated-app-42' });
  });

  it('구 ai-generator 경로는 create-app 으로 정규화한다', () => {
    expect(parseShellPathname('/app/ai-generator')).toEqual({ kind: 'app', appId: 'create-app' });
  });

  it('알 수 없는 경로는 home 이다', () => {
    expect(parseShellPathname('/unknown/thing')).toEqual({ kind: 'home' });
    expect(parseShellPathname('/me/invalid-tab')).toEqual({ kind: 'home' });
  });

  it('formatShellPath 가 parse 와 역호환된다', () => {
    const routes = [
      { kind: 'home' as const },
      { kind: 'auth' as const, mode: 'login' as const },
      { kind: 'me' as const, tab: 'credit' as const },
      { kind: 'app' as const, appId: 'weather' },
      { kind: 'app' as const, appId: 'create-app' },
      { kind: 'app' as const, appId: 'generated-app-7' },
    ] as const;
    for (const r of routes) {
      expect(parseShellPathname(formatShellPath(r))).toEqual(r);
    }
  });
});
