import { MOA_SHELL_NOTICE_BOARD_SLUG } from './moaShellNoticeBoard';

export const NOTICE_BOARD_CATEGORIES = {
  notices: '공지사항',
  updates: '업데이트',
} as const;

export type NoticeBoardCategory = (typeof NOTICE_BOARD_CATEGORIES)[keyof typeof NOTICE_BOARD_CATEGORIES];

export type NoticeBadgeKind = 'new' | 'popular' | 'notice' | 'update';

export type BoardNoticePreview = {
  id?: number | string;
  title?: string | null;
  content_preview?: string | null;
  created_at_formatted?: string | null;
  created_at?: string | null;
  category?: string | null;
  is_notice?: boolean;
  is_new?: boolean;
  view_count?: number;
  row_type?: string | null;
};

export type ShellNoticePreviewItem = {
  id: string;
  title: string;
  desc: string;
  date: string;
  category: NoticeBoardCategory;
  boardSlug: string;
  postId: string;
  badges: NoticeBadgeKind[];
};

const POPULAR_NOTICE_VIEW_THRESHOLD = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractBoardNoticePreviews(payload: unknown): BoardNoticePreview[] {
  const body = isRecord(payload) && 'data' in payload ? payload.data : payload;
  const data = isRecord(body) && Array.isArray(body.data) ? body.data : Array.isArray(body) ? body : [];

  return data.filter(isRecord).map(item => item as BoardNoticePreview);
}

function createNoticeBadges(post: BoardNoticePreview, category: NoticeBoardCategory): NoticeBadgeKind[] {
  const badges: NoticeBadgeKind[] = [];
  if (post.is_new) {
    badges.push('new');
  }
  if (Number(post.view_count ?? 0) >= POPULAR_NOTICE_VIEW_THRESHOLD) {
    badges.push('popular');
  }
  if (post.is_notice || post.row_type === 'notice') {
    badges.push('notice');
  }
  if (category === NOTICE_BOARD_CATEGORIES.updates) {
    badges.push('update');
  }

  return badges;
}

export function toShellNoticePreviewItem(
  post: BoardNoticePreview,
  category: NoticeBoardCategory,
): ShellNoticePreviewItem | null {
  if (post.id == null || !post.title) {
    return null;
  }
  if (post.category !== category) {
    return null;
  }

  return {
    id: `live-${category}-${post.id}`,
    title: post.title,
    desc: post.content_preview?.trim() || `${category} 게시글`,
    date: post.created_at_formatted ?? post.created_at ?? '',
    category,
    boardSlug: MOA_SHELL_NOTICE_BOARD_SLUG,
    postId: String(post.id),
    badges: createNoticeBadges(post, category),
  };
}

async function loadByCategory(
  category: NoticeBoardCategory,
  signal?: AbortSignal,
): Promise<ShellNoticePreviewItem[]> {
  const params = new URLSearchParams({
    page: '1',
    per_page: '5',
    category,
  });
  const response = await fetch(
    `/api/modules/sirsoft-board/boards/${encodeURIComponent(MOA_SHELL_NOTICE_BOARD_SLUG)}/posts?${params.toString()}`,
    {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal,
    },
  );
  if (!response.ok) {
    return [];
  }

  const payload: unknown = await response.json();
  return extractBoardNoticePreviews(payload)
    .map(post => toShellNoticePreviewItem(post, category))
    .filter((item): item is ShellNoticePreviewItem => item !== null);
}

export async function fetchShellNoticeBoardPreview(
  signal?: AbortSignal,
): Promise<{ notices: ShellNoticePreviewItem[]; updates: ShellNoticePreviewItem[] }> {
  const [notices, updates] = await Promise.all([
    loadByCategory(NOTICE_BOARD_CATEGORIES.notices, signal),
    loadByCategory(NOTICE_BOARD_CATEGORIES.updates, signal),
  ]);

  return { notices, updates };
}
