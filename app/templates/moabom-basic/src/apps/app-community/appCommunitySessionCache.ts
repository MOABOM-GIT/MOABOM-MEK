import type { AppCommunityListResponse, AppCommunitySummary } from '../../api/moabomAppCommunityApi';

const CACHE_TTL_MS = 30_000;

type AppCommunityCacheEntry = {
  summary: AppCommunitySummary | null;
  posts: AppCommunityListResponse | null;
  fetchedAt: number;
};

const cache = new Map<string, AppCommunityCacheEntry>();

function cacheKey(appId: number, authStateKey: string): string {
  return `${authStateKey || 'guest'}:${appId}`;
}

function isFresh(entry: AppCommunityCacheEntry | undefined): entry is AppCommunityCacheEntry {
  return entry != null && Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

export function readAppCommunitySessionCache(
  appId: number,
  authStateKey: string,
): AppCommunityCacheEntry | null {
  const entry = cache.get(cacheKey(appId, authStateKey));
  return isFresh(entry) ? entry : null;
}

export function writeAppCommunitySessionCache(
  appId: number,
  authStateKey: string,
  partial: {
    summary?: AppCommunitySummary | null;
    posts?: AppCommunityListResponse | null;
  },
): void {
  const key = cacheKey(appId, authStateKey);
  const prev = cache.get(key);
  cache.set(key, {
    summary: partial.summary !== undefined ? partial.summary : (prev?.summary ?? null),
    posts: partial.posts !== undefined ? partial.posts : (prev?.posts ?? null),
    fetchedAt: Date.now(),
  });
}

export function invalidateAppCommunitySessionCache(appId: number, authStateKey: string): void {
  cache.delete(cacheKey(appId, authStateKey));
}

/** 인증 계정 경계 전환 — 사용자 권한·내 리뷰 스냅샷을 모두 폐기한다. */
export function clearAppCommunitySessionCache(): void {
  cache.clear();
}
