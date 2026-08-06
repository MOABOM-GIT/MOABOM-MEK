import { fetchVisibleGeneratedApp, type StoredGeneratedApp } from '../../api/moabomAppsApi';

const TTL_MS = 30_000;

export type LoadVisibleGeneratedAppOptions = {
  /**
   * true: 편집·리믹스용 HTML 포함 show.
   * false(기본): 실행·권한·타이틀용 메타 show — iframe 은 preview_url 만 사용.
   */
  includeHtml?: boolean;
};

type CacheEntry = {
  at: number;
  data: StoredGeneratedApp;
  includeHtml: boolean;
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<StoredGeneratedApp>>();

export function buildGeneratedAppVisibleCacheKey(
  serverId: number,
  authStateKey: string,
  includeHtml = false,
): string {
  return `${authStateKey || 'guest'}:${serverId}:html=${includeHtml ? 1 : 0}`;
}

function cacheSatisfies(entry: CacheEntry, includeHtml: boolean): boolean {
  if (Date.now() - entry.at >= TTL_MS) {
    return false;
  }
  // HTML 포함 캐시는 메타 요청에도 재사용 가능. 반대는 불가.
  return includeHtml ? entry.includeHtml : true;
}

/**
 * 생성앱 visible API — 동일 (auth, appId, includeHtml) in-flight 병합 + 30s 세션 캐시.
 * 앱 리뷰 권한·뷰어·편집 셸이 중복 호출하지 않도록 한다.
 */
export async function loadVisibleGeneratedAppSession(
  serverId: number,
  authStateKey: string,
  options?: LoadVisibleGeneratedAppOptions,
): Promise<StoredGeneratedApp> {
  const includeHtml = options?.includeHtml === true;
  const key = buildGeneratedAppVisibleCacheKey(serverId, authStateKey, includeHtml);

  // 메타 요청이면 HTML 풀 캐시도 히트.
  if (!includeHtml) {
    const fullKey = buildGeneratedAppVisibleCacheKey(serverId, authStateKey, true);
    const fullHit = cache.get(fullKey);
    if (fullHit && cacheSatisfies(fullHit, false)) {
      return fullHit.data;
    }
  }

  const hit = cache.get(key);
  if (hit && cacheSatisfies(hit, includeHtml)) {
    return hit.data;
  }

  const pending = inflight.get(key);
  if (pending) {
    return pending;
  }

  const request = fetchVisibleGeneratedApp(serverId, { includeHtml })
    .then(data => {
      cache.set(key, { at: Date.now(), data, includeHtml });
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
    if (key.includes(`:${serverId}:`)) {
      cache.delete(key);
      inflight.delete(key);
    }
  }
}
