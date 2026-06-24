import { describe, expect, it } from 'vitest';
import { formatShellPath, formatShellPathForWindow, formatBoardShellPath, parseShellPathname, parseShellRoute } from './moabomShellRoutes';
import { moaShellBoardAppId } from '../shell/moaShellBoardIds';

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

  it('레거시 /mypage 경로를 /me 탭으로 정규화한다', () => {
    expect(parseShellPathname('/mypage')).toEqual({ kind: 'me', tab: 'profile' });
    expect(parseShellPathname('/mypage/activity')).toEqual({ kind: 'me', tab: 'activity' });
    expect(parseShellPathname('/mypage/change-password')).toEqual({ kind: 'me', tab: 'account' });
    expect(parseShellPathname('/mypage/orders/ORD-1')).toEqual({
      kind: 'router',
      path: '/mypage/orders/ORD-1',
    });
  });

  it('앱 경로를 파싱한다', () => {
    const r = parseShellPathname('/app/cpap-mask');
    expect(r).toEqual({ kind: 'app', appId: 'cpap-mask' });
  });

  it('제거된 더미 앱 경로는 홈으로 정규화한다', () => {
    expect(parseShellPathname('/app/weather')).toEqual({ kind: 'home' });
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

  it('게시판 경로를 파싱한다', () => {
    expect(parseShellPathname('/board/notice')).toEqual({ kind: 'board', slug: 'notice' });
    expect(parseShellPathname('/board/notice/42')).toEqual({
      kind: 'board',
      slug: 'notice',
      postId: '42',
    });
    expect(parseShellPathname('/board/notice/write')).toEqual({ kind: 'board', slug: 'notice', boardMode: 'write' });
    expect(formatShellPath({ kind: 'board', slug: 'notice' })).toBe('/board/notice');
    expect(formatShellPath({ kind: 'board', slug: 'notice', postId: '42' })).toBe('/board/notice/42');
    expect(formatShellPath({ kind: 'board', slug: 'notice', boardMode: 'write' })).toBe('/board/notice/write');
    expect(formatShellPath({ kind: 'board', slug: 'notice', postId: '42', boardMode: 'edit' })).toBe('/board/notice/42/edit');
  });

  it('formatBoardShellPath 가 쿼리를 붙인다', () => {
    expect(formatBoardShellPath('notice', undefined, 'page=2')).toBe('/board/notice?page=2');
  });

  it('formatShellPathForWindow 가 사용자 프로필 윈도우 경로를 생성한다', () => {
    const appId = 'moa-shell-user:00000000-0000-4000-8000-000000000001';
    expect(formatShellPathForWindow({ appId, userProfileUuid: '00000000-0000-4000-8000-000000000001' }))
      .toBe('/users/00000000-0000-4000-8000-000000000001');
    expect(formatShellPathForWindow({
      appId,
      userProfileUuid: '00000000-0000-4000-8000-000000000001',
      userProfileView: 'posts',
    }))
      .toBe('/users/00000000-0000-4000-8000-000000000001/posts');
    expect(formatShellPathForWindow({
      appId,
      userProfileUuid: '00000000-0000-4000-8000-000000000001',
      userProfileView: 'chat',
    }))
      .toBe('/users/00000000-0000-4000-8000-000000000001/chat');
  });

  it('parseShellRoute 가 사용자 프로필 하위 경로를 해석한다', () => {
    const uuid = '00000000-0000-4000-8000-000000000001';
    expect(parseShellRoute(`/users/${uuid}`)).toEqual({
      kind: 'userProfile',
      uuid,
      view: 'profile',
    });
    expect(parseShellRoute(`/users/${uuid}/posts`)).toEqual({
      kind: 'userProfile',
      uuid,
      view: 'posts',
    });
    expect(parseShellRoute(`/users/${uuid}/chat`)).toEqual({
      kind: 'userProfile',
      uuid,
      view: 'chat',
    });
  });

  it('formatShellPathForWindow 가 게시판·프로필 윈도우 경로를 생성한다', () => {
    const appId = moaShellBoardAppId('notice');
    expect(formatShellPathForWindow({ appId, boardSlug: 'notice' })).toBe('/board/notice');
    expect(formatShellPathForWindow({ appId, boardSlug: 'notice', boardPostId: '42' })).toBe('/board/notice/42');
    expect(formatShellPathForWindow({ appId, boardSlug: 'notice', boardMode: 'write' })).toBe('/board/notice/write');
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
      { kind: 'app' as const, appId: 'cpap-mask' },
      { kind: 'app' as const, appId: 'create-app' },
      { kind: 'app' as const, appId: 'generated-app-7' },
      { kind: 'board' as const, slug: 'notice' },
      { kind: 'board' as const, slug: 'free', postId: '9' },
      { kind: 'board' as const, slug: 'notice', boardMode: 'write' },
      { kind: 'board' as const, slug: 'free', postId: '9', boardMode: 'edit' },
      { kind: 'userProfile' as const, uuid: '00000000-0000-4000-8000-000000000001', view: 'profile' as const },
      { kind: 'userProfile' as const, uuid: '00000000-0000-4000-8000-000000000001', view: 'posts' as const },
    ] as const;
    for (const r of routes) {
      expect(parseShellPathname(formatShellPath(r))).toEqual(r);
    }
  });
});
