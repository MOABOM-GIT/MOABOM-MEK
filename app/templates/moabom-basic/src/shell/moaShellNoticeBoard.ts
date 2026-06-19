/**
 * 좌측 패널 공지·업데이트 더미 데이터 → 게시판 윈도우 연결.
 * 실 API 게시글 ID가 있으면 mock 항목의 postId로 상세 deep link.
 */
export const MOA_SHELL_NOTICE_BOARD_SLUG = 'notice';

export type ShellNoticeBoardLink = {
  boardSlug?: string;
  postId?: string;
};

export function resolveShellNoticeBoardTarget(item: ShellNoticeBoardLink): {
  slug: string;
  postId?: string;
} {
  return {
    slug: item.boardSlug ?? MOA_SHELL_NOTICE_BOARD_SLUG,
    postId: item.postId,
  };
}

export function openShellNoticeBoard(
  onOpenBoard: ((slug: string, postId?: string) => void) | undefined,
  item: ShellNoticeBoardLink,
): void {
  if (!onOpenBoard) return;
  const { slug, postId } = resolveShellNoticeBoardTarget(item);
  onOpenBoard(slug, postId);
}
