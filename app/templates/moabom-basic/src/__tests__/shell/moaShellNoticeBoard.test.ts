import { describe, expect, it, vi } from 'vitest';
import { NOTICE_DATA } from '../../data/Moa_mockData';
import {
  MOA_SHELL_NOTICE_BOARD_SLUG,
  openShellNoticeBoard,
  resolveShellNoticeBoardTarget,
} from '../../shell/moaShellNoticeBoard';

describe('moaShellNoticeBoard', () => {
  it('기본 slug는 notice', () => {
    expect(MOA_SHELL_NOTICE_BOARD_SLUG).toBe('notice');
    expect(resolveShellNoticeBoardTarget({}).slug).toBe('notice');
  });

  it('mock 공지·업데이트 항목은 boardSlug를 갖는다', () => {
    for (const item of [...NOTICE_DATA.notices, ...NOTICE_DATA.updates]) {
      expect(item.boardSlug).toBe('notice');
    }
  });

  it('openShellNoticeBoard는 slug·postId를 전달한다', () => {
    const onOpenBoard = vi.fn();
    openShellNoticeBoard(onOpenBoard, { boardSlug: 'notice', postId: '42' });
    expect(onOpenBoard).toHaveBeenCalledWith('notice', '42');
  });

  it('onOpenBoard 없으면 noop', () => {
    expect(() => openShellNoticeBoard(undefined, { boardSlug: 'notice' })).not.toThrow();
  });
});
