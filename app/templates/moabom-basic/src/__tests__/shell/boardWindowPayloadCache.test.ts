import { describe, expect, it } from 'vitest';
import {
  buildBoardFetchToken,
  clearBoardPayloadCacheForTests,
  getBoardPayloadCacheEntry,
  invalidateBoardPayloadCacheForList,
  invalidateBoardPayloadCacheForPost,
  setBoardPayloadCacheEntry,
} from '../../shell/boardWindowPayloadCache';
import type { BoardWindowRenderPayload } from '../../shell/boardWindowLayoutRuntime';

function makePayload(dataContext: Record<string, unknown> = {}): BoardWindowRenderPayload {
  return {
    DynamicRenderer: () => null,
    componentDefs: [],
    dataContext,
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

describe('boardWindowPayloadCache', () => {
  it('urlEpoch 가 바뀌면 동일 cacheKey 도 캐시를 쓰지 않는다', () => {
    clearBoardPayloadCacheForTests();
    const key = 'notice:42:::1:guest';
    const payload = makePayload({ post: { data: { reply_count: 0 } } });
    setBoardPayloadCacheEntry(key, buildBoardFetchToken(key, 0), payload);

    expect(getBoardPayloadCacheEntry(key, buildBoardFetchToken(key, 0))).toBe(payload);
    expect(getBoardPayloadCacheEntry(key, buildBoardFetchToken(key, 1))).toBeUndefined();
  });

  it('invalidateBoardPayloadCacheForPost 는 해당 글 캐시만 제거한다', () => {
    clearBoardPayloadCacheForTests();
    const parentKey = 'notice:42:::1:guest';
    const otherKey = 'notice:99:::1:guest';
    const parentPayload = makePayload();
    const otherPayload = makePayload({ post: { data: { id: 99 } } });
    const token = buildBoardFetchToken(parentKey, 0);

    setBoardPayloadCacheEntry(parentKey, token, parentPayload);
    setBoardPayloadCacheEntry(otherKey, token, otherPayload);

    invalidateBoardPayloadCacheForPost('notice', 42);

    expect(getBoardPayloadCacheEntry(parentKey, token)).toBeUndefined();
    expect(getBoardPayloadCacheEntry(otherKey, token)).toBe(otherPayload);
  });

  it('invalidateBoardPayloadCacheForList 는 목록 캐시만 제거한다', () => {
    clearBoardPayloadCacheForTests();
    const listKey = 'notice:::1:guest';
    const detailKey = 'notice:42:::1:guest';
    const token = buildBoardFetchToken(listKey, 0);

    setBoardPayloadCacheEntry(listKey, token, makePayload());
    setBoardPayloadCacheEntry(detailKey, token, makePayload({ post: { data: { id: 42 } } }));

    invalidateBoardPayloadCacheForList('notice');

    expect(getBoardPayloadCacheEntry(listKey, token)).toBeUndefined();
    expect(getBoardPayloadCacheEntry(detailKey, token)).toBeDefined();
  });
});
