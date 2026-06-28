import { fetchVisibleGeneratedApp, type StoredGeneratedApp } from '../../api/moabomAppsApi';

const TTL_MS = 30_000;

type CacheEntry = {
  at: number;
  data: StoredGeneratedApp;
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<StoredGeneratedApp>>();

export function buildGeneratedAppVisibleCacheKey(serverId: number, authStateKey: string): string {
  return `${authStateKey || 'guest'}:${serverId}`;
}

/**
 * 생성앱 visible API — 동일 (auth, appId) in-flight 병합 + 30s 세션 캐시.
 * 앱 리뷰 권한·뷰어·편집 셸이 중복 호출하지 않도록 한다.
 */
export async function loadVisibleGeneratedAppSession(
  serverId: number,
  authStateKey: string,
): Promise<StoredGeneratedApp> {
  const key = buildGeneratedAppVisibleCacheKey(serverId, authStateKey);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return hit.data;
  }

  const pending = inflight.get(key);
  if (pending) {
    return pending;
  }

  const request = fetchVisibleGeneratedApp(serverId)
    .then(data => {
      cache.set(key, { at: Date.now(), data });
      inflight.delete(key);
      return data;
    })
    .catch(error => {
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, request);
  return request;
}

export function invalidateVisibleGeneratedAppSession(serverId: number): void {
  for (const key of [...cache.keys()]) {
    if (key.endsWith(`:${serverId}`)) {
      cache.delete(key);
      inflight.delete(key);
    }
  }
}
