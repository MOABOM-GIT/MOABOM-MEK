import { normalizePathname } from '../utils/moabomLegacyMypagePaths';
import { parseShellRoute } from '../utils/moabomShellRoutes';
import {
  invalidateBoardPayloadCacheForList,
  invalidateBoardPayloadCacheForPost,
} from './boardWindowPayloadCache';
import { notifyBoardShellUrlChanged } from './moaShellBoardBridge';

export interface BoardShellCacheTarget {
  slug: string;
  postId?: string;
}

function extractPathnameForBoardParse(pathOrUrl: string): string {
  const trimmed = pathOrUrl.trim();
  if (!trimmed) {
    return '/';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return normalizePathname(new URL(trimmed).pathname);
    } catch {
      return normalizePathname(trimmed);
    }
  }

  const base = trimmed.split(/[?#]/)[0] ?? trimmed;
  return normalizePathname(base.startsWith('/') ? base : `/${base}`);
}

export function parseBoardShellCacheTargetFromPath(pathOrUrl: string): BoardShellCacheTarget | null {
  const pathname = extractPathnameForBoardParse(pathOrUrl);
  const search = pathOrUrl.includes('?') ? pathOrUrl.slice(pathOrUrl.indexOf('?')) : '';
  const route = parseShellRoute(pathname, search);
  if (route.kind !== 'board') {
    return null;
  }

  return {
    slug: route.slug,
    postId: route.postId,
  };
}

function pickString(data: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = data[key];
    if (value != null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return undefined;
}

export function parseBoardShellCacheTargetFromNotificationData(
  data?: Record<string, unknown> | null,
): BoardShellCacheTarget | null {
  if (!data) {
    return null;
  }

  const fromUrl = pickString(data, ['post_url', 'report_url']);
  if (fromUrl) {
    const parsed = parseBoardShellCacheTargetFromPath(fromUrl);
    if (parsed) {
      return parsed;
    }
  }

  const slug = pickString(data, ['board_slug', 'slug', 'board']);
  if (!slug) {
    return null;
  }

  return {
    slug,
    postId: pickString(data, ['post_id', 'postId']),
  };
}

export function isBoardRelatedNotificationType(notificationType?: string | null): boolean {
  const type = (notificationType ?? '').trim().toLowerCase();
  if (!type) {
    return false;
  }

  if (type.startsWith('board.')) {
    return true;
  }

  return (
    type === 'new_comment'
    || type === 'reply_comment'
    || type === 'post_reply'
    || type === 'post_action'
    || type === 'new_post_admin'
    || type === 'report_received_admin'
    || type.includes('comment')
    || type.includes('post')
    || type.includes('report')
  );
}

function shouldInvalidateBoardListCache(notificationType?: string | null): boolean {
  const type = (notificationType ?? '').trim().toLowerCase();
  if (!type) {
    return false;
  }

  return (
    type.includes('new_post')
    || type === 'post_reply'
    || type === 'post_action'
    || type.includes('blind')
    || type.includes('restore')
  );
}

/**
 * 알림·셸 navigate 직전 게시판 payload 캐시를 무효화하고 열린 BoardWindowHost refetch를 유도한다.
 * @returns 캐시 무효화가 수행되었으면 true
 */
export function invalidateBoardShellCacheForNavigate(
  targetPath: string,
  notificationType?: string | null,
  notificationData?: Record<string, unknown> | null,
): boolean {
  let target = parseBoardShellCacheTargetFromPath(targetPath);
  if (!target && isBoardRelatedNotificationType(notificationType)) {
    target = parseBoardShellCacheTargetFromNotificationData(notificationData);
  }
  if (!target) {
    return false;
  }

  if (target.postId) {
    invalidateBoardPayloadCacheForPost(target.slug, target.postId);
    if (shouldInvalidateBoardListCache(notificationType)) {
      invalidateBoardPayloadCacheForList(target.slug);
    }
  } else {
    invalidateBoardPayloadCacheForList(target.slug);
  }

  notifyBoardShellUrlChanged();
  return true;
}
