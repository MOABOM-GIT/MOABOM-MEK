import { describe, expect, it, vi } from 'vitest';
import type { ActivityItem } from './myPageTypes';
import { openMyPageActivityBoard, resolveMyPageActivityBoardTarget } from './myPageActivityBoard';

const baseItem = (overrides: Partial<ActivityItem> = {}): ActivityItem => ({
  id: 'post-1',
  type: 'post',
  type_label: '작성글',
  title: '제목',
  ...overrides,
});

describe('resolveMyPageActivityBoardTarget', () => {
  it('board_slug·post_id 로 셸 경로를 만든다', () => {
    const target = resolveMyPageActivityBoardTarget(baseItem({
      board_slug: 'notice',
      post_id: 42,
    }));

    expect(target).toEqual({
      slug: 'notice',
      postId: '42',
      shellPath: '/board/notice/42',
    });
  });

  it('comment_id 가 있으면 hash 를 붙인다', () => {
    const target = resolveMyPageActivityBoardTarget(baseItem({
      board_slug: 'free',
      post_id: 7,
      comment_id: 99,
    }));

    expect(target?.shellPath).toBe('/board/free/7#comment-99');
  });

  it('레거시 /board/{slug}/post/{id} URL 을 파싱한다', () => {
    const target = resolveMyPageActivityBoardTarget(baseItem({
      target_url: '/board/notice/post/12#comment-3',
    }));

    expect(target).toEqual({
      slug: 'notice',
      postId: '12',
      shellPath: '/board/notice/post/12#comment-3',
    });
  });
});

describe('openMyPageActivityBoard', () => {
  it('onOpenBoard 로 slug·postId·shellPath 를 전달한다', () => {
    const onOpenBoard = vi.fn();
    const opened = openMyPageActivityBoard(onOpenBoard, baseItem({
      board_slug: 'notice',
      post_id: 5,
    }));

    expect(opened).toBe(true);
    expect(onOpenBoard).toHaveBeenCalledWith('notice', '5', {
      shellPath: '/board/notice/5',
    });
  });
});
