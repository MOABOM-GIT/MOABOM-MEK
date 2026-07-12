import { describe, expect, it } from 'vitest';
import { BOARD_SHELL_LAYOUT_PATHS, buildBoardPayloadCacheKey } from './boardWindowPrefetch';

describe('boardWindowPrefetch', () => {
  it('buildBoardPayloadCacheKey 가 slug·post·mode·page·auth 를 포함한다', () => {
    expect(
      buildBoardPayloadCacheKey('notice', undefined, undefined, { page: '2' }, 'guest'),
    ).toBe('notice:::2:guest');
    expect(
      buildBoardPayloadCacheKey('notice', '42', undefined, {}, 'user-1'),
    ).toBe('notice:42:::1:user-1');
  });

  it('BOARD_SHELL_LAYOUT_PATHS 에 index·show·form 이 모두 있다', () => {
    expect(BOARD_SHELL_LAYOUT_PATHS).toEqual(['board/index', 'board/show', 'board/form']);
  });
});
