import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildBoardFetchToken,
  clearBoardPayloadCacheForTests,
  getBoardPayloadCacheEntry,
  setBoardPayloadCacheEntry,
} from '../../shell/boardWindowPayloadCache';
import {
  invalidateBoardShellCacheForNavigate,
  isBoardRelatedNotificationType,
  parseBoardShellCacheTargetFromNotificationData,
  parseBoardShellCacheTargetFromPath,
} from '../../shell/invalidateBoardShellCacheForNavigate';
import type { BoardWindowRenderPayload } from '../../shell/boardWindowLayoutRuntime';

function makePayload(): BoardWindowRenderPayload {
  return {
    DynamicRenderer: () => null,
    componentDefs: [],
    dataContext: {},
    translationContext: { templateId: 'moabom-basic', locale: 'ko' },
    registry: null,
    bindingEngine: null,
    translationEngine: null,
    actionDispatcher: null,
    layoutName: 'board/show',
    boardSessionKey: 'notice:42',
    layoutDataSources: [],
    route: { slug: 'notice', id: '42' },
    query: {},
  };
}

describe('invalidateBoardShellCacheForNavigate', () => {
  beforeEach(() => {
    clearBoardPayloadCacheForTests();
    vi.restoreAllMocks();
  });

  it('parseBoardShellCacheTargetFromPath 는 게시판 경로를 파싱한다', () => {
    expect(parseBoardShellCacheTargetFromPath('/board/notice/42')).toEqual({
      slug: 'notice',
      postId: '42',
    });
    expect(parseBoardShellCacheTargetFromPath('https://mek360.com/board/notice')).toEqual({
      slug: 'notice',
      postId: undefined,
    });
    expect(parseBoardShellCacheTargetFromPath('/me/profile')).toBeNull();
  });

  it('notification data post_url 로 slug·postId 를 추출한다', () => {
    expect(
      parseBoardShellCacheTargetFromNotificationData({
        post_url: 'https://mek360.com/board/notice/99',
      }),
    ).toEqual({ slug: 'notice', postId: '99' });
  });

  it('isBoardRelatedNotificationType 는 board·comment 계열을 식별한다', () => {
    expect(isBoardRelatedNotificationType('board.comment_received')).toBe(true);
    expect(isBoardRelatedNotificationType('new_comment')).toBe(true);
    expect(isBoardRelatedNotificationType('welcome')).toBe(false);
  });

  it('게시글 알림 navigate 시 해당 post 캐시만 무효화하고 url 이벤트를 발행한다', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const postKey = 'notice:42:::1:guest';
    const listKey = 'notice:::1:guest';
    const token = buildBoardFetchToken(postKey, 0);

    setBoardPayloadCacheEntry(postKey, token, makePayload());
    setBoardPayloadCacheEntry(listKey, token, makePayload());

    const changed = invalidateBoardShellCacheForNavigate(
      '/board/notice/42',
      'board.comment_received',
    );

    expect(changed).toBe(true);
    expect(getBoardPayloadCacheEntry(postKey, token)).toBeUndefined();
    expect(getBoardPayloadCacheEntry(listKey, token)).toBeDefined();
    expect(dispatchSpy).toHaveBeenCalled();
  });

  it('new_post 계열은 목록 캐시도 무효화한다', () => {
    const postKey = 'notice:42:::1:guest';
    const listKey = 'notice:::1:guest';
    const token = buildBoardFetchToken(postKey, 0);

    setBoardPayloadCacheEntry(postKey, token, makePayload());
    setBoardPayloadCacheEntry(listKey, token, makePayload());

    invalidateBoardShellCacheForNavigate('/board/notice/42', 'board.new_post_admin');

    expect(getBoardPayloadCacheEntry(postKey, token)).toBeUndefined();
    expect(getBoardPayloadCacheEntry(listKey, token)).toBeUndefined();
  });

  it('board 경로가 없어도 notification data 로 무효화한다', () => {
    const postKey = 'notice:55:::1:guest';
    const token = buildBoardFetchToken(postKey, 0);
    setBoardPayloadCacheEntry(postKey, token, makePayload());

    const changed = invalidateBoardShellCacheForNavigate(
      '/me/activity',
      'board.comment_received',
      { post_url: '/board/notice/55' },
    );

    expect(changed).toBe(true);
    expect(getBoardPayloadCacheEntry(postKey, token)).toBeUndefined();
  });
});
