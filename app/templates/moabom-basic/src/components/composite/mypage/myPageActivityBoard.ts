import type { ActivityItem } from './myPageTypes';
import type { ShellUrlSync } from '../../../shell/moaShellTypes';

export type MyPageActivityBoardTarget = {
  slug: string;
  postId: string;
  shellPath: string;
};

/**
 * 활동 항목 → 셸 게시판 윈도우 대상 (`/board/{slug}/{postId}`).
 * 레거시 `/board/{slug}/post/{id}` URL 도 파싱한다.
 */
export function resolveMyPageActivityBoardTarget(item: ActivityItem): MyPageActivityBoardTarget | null {
  if (item.board_slug && item.post_id != null && item.post_id > 0) {
    const slug = item.board_slug.trim();
    const postId = String(item.post_id);
    if (!slug) {
      return null;
    }

    let shellPath = `/board/${encodeURIComponent(slug)}/${encodeURIComponent(postId)}`;
    if (item.comment_id != null && item.comment_id > 0) {
      shellPath += `#comment-${item.comment_id}`;
    }

    return { slug, postId, shellPath };
  }

  const raw = item.target_url?.trim();
  if (!raw) {
    return null;
  }

  const hashIndex = raw.indexOf('#');
  const pathPart = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
  const hash = hashIndex >= 0 ? raw.slice(hashIndex) : '';
  const parts = pathPart.split('/').filter(Boolean);
  if (parts[0] !== 'board' || !parts[1]) {
    return null;
  }

  const slug = decodeURIComponent(parts[1]);
  let postId: string | undefined;
  if (parts[2] === 'post' && parts[3]) {
    postId = decodeURIComponent(parts[3]);
  } else if (parts[2] && parts[2] !== 'write') {
    postId = decodeURIComponent(parts[2]);
  }

  if (!slug || !postId) {
    return null;
  }

  return {
    slug,
    postId,
    shellPath: `${pathPart}${hash}`,
  };
}

export type OpenMyPageActivityBoard = (
  slug: string,
  postId?: string,
  sync?: ShellUrlSync,
) => void;

export function openMyPageActivityBoard(
  onOpenBoard: OpenMyPageActivityBoard | undefined,
  item: ActivityItem,
): boolean {
  const target = resolveMyPageActivityBoardTarget(item);
  if (!target || !onOpenBoard) {
    return false;
  }

  onOpenBoard(target.slug, target.postId, { shellPath: target.shellPath });
  return true;
}
