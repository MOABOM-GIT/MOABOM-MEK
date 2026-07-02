import { MOA_SHELL_NOTICE_BOARD_SLUG } from './moaShellNoticeBoard';
import { invalidateShellNoticeBoardPreviewCache } from './moaShellNoticeBoardPreview';

export const MOA_SHELL_NOTICE_BOARD_CHANGED_EVENT = 'moabom-shell-notice-board-changed';

export type ShellNoticeBoardChangeAction = 'created' | 'updated' | 'deleted';

export type ShellNoticeBoardChangedDetail = {
  slug: string;
  postId?: string;
  action: ShellNoticeBoardChangeAction;
};

export function notifyShellNoticeBoardChanged(detail: ShellNoticeBoardChangedDetail): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (detail.slug !== MOA_SHELL_NOTICE_BOARD_SLUG) {
    return;
  }

  // 게시글 저장·수정·삭제 시점에만 캐시 무효화 (폴링·상시 구독 없음)
  invalidateShellNoticeBoardPreviewCache();

  window.dispatchEvent(
    new CustomEvent<ShellNoticeBoardChangedDetail>(MOA_SHELL_NOTICE_BOARD_CHANGED_EVENT, { detail }),
  );
}

export function subscribeShellNoticeBoardChanged(
  handler: (detail: ShellNoticeBoardChangedDetail) => void,
): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<ShellNoticeBoardChangedDetail>).detail;
    if (!detail || detail.slug !== MOA_SHELL_NOTICE_BOARD_SLUG) {
      return;
    }
    handler(detail);
  };

  window.addEventListener(MOA_SHELL_NOTICE_BOARD_CHANGED_EVENT, listener);

  return () => window.removeEventListener(MOA_SHELL_NOTICE_BOARD_CHANGED_EVENT, listener);
}
