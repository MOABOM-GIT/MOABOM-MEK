import {
  loadG7LayoutWindowPayload,
  type BoardWindowRenderPayload,
} from './boardWindowLayoutRuntime';
import {
  buildUserProfilePayloadCacheKey,
  getCachedUserProfilePayload,
  resolveUserProfileWindowQuery,
  setCachedUserProfilePayload,
} from './userProfileWindowPrefetch';
import { resolvePublicProfileDisplayName } from '../utils/resolvePublicProfileDisplayName';

/** moabom-basic 템플릿 G7 순정 users 레이아웃 (셸 윈도우용) */
export const USER_PROFILE_LAYOUT_PATH = 'users/show';
export const USER_POSTS_LAYOUT_PATH = 'users/posts';

export type UserProfileWindowView = 'profile' | 'posts' | 'chat';

export function resolveUserProfileLayoutPath(view: UserProfileWindowView = 'profile'): string {
  if (view === 'chat') {
    return USER_PROFILE_LAYOUT_PATH;
  }
  return view === 'posts' ? USER_POSTS_LAYOUT_PATH : USER_PROFILE_LAYOUT_PATH;
}

export function resolveUserProfileViewFromPathname(pathname?: string): UserProfileWindowView {
  if (typeof pathname !== 'string') {
    return 'profile';
  }
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (parts[0] === 'users' && parts[2] === 'posts') {
    return 'posts';
  }
  if (parts[0] === 'users' && parts[2] === 'chat') {
    return 'chat';
  }
  return 'profile';
}

export async function loadUserProfileWindowRenderPayload(
  userUuid: string,
  view: UserProfileWindowView = 'profile',
  queryOverride?: Record<string, string | string[]>,
): Promise<BoardWindowRenderPayload> {
  const query = queryOverride ?? resolveUserProfileWindowQuery();
  const cacheKey = buildUserProfilePayloadCacheKey(userUuid, view, query);
  const cached = getCachedUserProfilePayload(cacheKey);
  if (cached) {
    return cached;
  }

  const layoutPath = resolveUserProfileLayoutPath(view);
  const payload = await loadG7LayoutWindowPayload(layoutPath, { userId: userUuid }, query);
  setCachedUserProfilePayload(cacheKey, payload);
  return payload;
}

export function resolveUserProfileWindowTitle(
  fetched: Record<string, unknown>,
  _view: UserProfileWindowView = 'profile',
): string | null {
  const profile = (fetched.profile ?? fetched.userProfile) as {
    data?: { name?: string; nickname?: string | null };
  } | undefined;
  const displayName = resolvePublicProfileDisplayName(profile?.data);
  if (!displayName) {
    return null;
  }
  return displayName;
}

export { buildUserProfilePayloadCacheKey } from './userProfileWindowPrefetch';
