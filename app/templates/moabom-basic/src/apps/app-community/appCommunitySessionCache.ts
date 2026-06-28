import type { AppCommunityListResponse, AppCommunitySummary } from '../api/moabomAppCommunityApi';

const CACHE_TTL_MS = 30_000;

type AppCommunityCacheEntry = {
  summary: AppCommunitySummary | null;
  posts: AppCommunityListResponse | null;
  fetchedAt: number;
};

const cache = new Map<number, AppCommunityCacheEntry>();

function isFresh(entry: AppCommunityCacheEntry | undefined): entry is AppCommunityCacheEntry {
  return entry != null && Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

export function readAppCommunitySessionCache(appId: number): AppCommunityCacheEntry | null {
  const entry = cache.get(appId);
  return isFresh(entry) ? entry : null;
}

export function writeAppCommunitySessionCache(
  appId: number,
  partial: {
    summary?: AppCommunitySummary | null;
    posts?: AppCommunityListResponse | null;
  },
): void {
  const prev = cache.get(appId);
  cache.set(appId, {
    summary: partial.summary !== undefined ? partial.summary : (prev?.summary ?? null),
    posts: partial.posts !== undefined ? partial.posts : (prev?.posts ?? null),
    fetchedAt: Date.now(),
  });
}

export function invalidateAppCommunitySessionCache(appId: number): void {
  cache.delete(appId);
}
