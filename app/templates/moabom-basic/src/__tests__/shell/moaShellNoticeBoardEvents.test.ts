import { describe, expect, it, vi } from 'vitest';

import { notifyShellNoticeBoardChangedHandler } from '../../handlers/notifyShellNoticeBoardChangedHandler';
import { MOA_SHELL_NOTICE_BOARD_SLUG } from '../moaShellNoticeBoard';
import {
  MOA_SHELL_NOTICE_BOARD_CHANGED_EVENT,
  notifyShellNoticeBoardChanged,
  subscribeShellNoticeBoardChanged,
} from '../moaShellNoticeBoardEvents';
import { toShellNoticePreviewItem } from '../moaShellNoticeBoardPreview';

describe('moaShellNoticeBoardEvents', () => {
  it('notice 보드 변경 이벤트를 발행한다', () => {
    const handler = vi.fn();
    const unsubscribe = subscribeShellNoticeBoardChanged(handler);

    notifyShellNoticeBoardChanged({
      slug: MOA_SHELL_NOTICE_BOARD_SLUG,
      postId: '12',
      action: 'updated',
    });

    expect(handler).toHaveBeenCalledWith({
      slug: MOA_SHELL_NOTICE_BOARD_SLUG,
      postId: '12',
      action: 'updated',
    });

    unsubscribe();
  });

  it('notice 보드가 아니면 이벤트를 무시한다', () => {
    const handler = vi.fn();
    const listener = vi.fn();
    window.addEventListener(MOA_SHELL_NOTICE_BOARD_CHANGED_EVENT, listener);
    const unsubscribe = subscribeShellNoticeBoardChanged(handler);

    notifyShellNoticeBoardChanged({
      slug: 'free',
      postId: '1',
      action: 'updated',
    });

    expect(handler).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
    window.removeEventListener(MOA_SHELL_NOTICE_BOARD_CHANGED_EVENT, listener);
  });
});

describe('notifyShellNoticeBoardChangedHandler', () => {
  it('notice slug 일 때만 이벤트를 발행한다', () => {
    const handler = vi.fn();
    const unsubscribe = subscribeShellNoticeBoardChanged(handler);

    void notifyShellNoticeBoardChangedHandler({
      params: {
        slug: MOA_SHELL_NOTICE_BOARD_SLUG,
        postId: '7',
        action: 'created',
      },
    });

    expect(handler).toHaveBeenCalledWith({
      slug: MOA_SHELL_NOTICE_BOARD_SLUG,
      postId: '7',
      action: 'created',
    });

    unsubscribe();
  });
});

describe('toShellNoticePreviewItem', () => {
  it('카테고리가 일치하는 게시글만 미리보기로 변환한다', () => {
    const item = toShellNoticePreviewItem(
      {
        id: 3,
        title: '점검 안내',
        content_preview: '내용',
        category: '공지사항',
        is_notice: true,
      },
      '공지사항',
    );

    expect(item).toMatchObject({
      title: '점검 안내',
      postId: '3',
      badges: ['notice'],
    });
  });
});
