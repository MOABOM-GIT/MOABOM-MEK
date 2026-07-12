import type { BoardWindowRenderPayload } from './boardWindowLayoutRuntime';

const payloadCache = new Map<string, BoardWindowRenderPayload>();
const lastFetchTokenByKey = new Map<string, string>();
const inflightLoads = new Map<string, Promise<BoardWindowRenderPayload>>();

export function buildBoardFetchToken(cacheKey: string, urlEpoch: number): string {
  return `${cacheKey}@${urlEpoch}`;
}

export function getBoardPayloadCacheEntry(
  cacheKey: string,
  _fetchToken?: string,
): BoardWindowRenderPayload | undefined {
  // urlEpoch(fetchToken) 과 무관하게 cacheKey 히트 — 목록↔상세 재진입 즉시 표시.
  // 글 작성·수정·삭제 후 stale 은 invalidateBoardPayloadCache* 가 담당.
  return payloadCache.get(cacheKey);
}

export function setBoardPayloadCacheEntry(
  cacheKey: string,
  fetchToken: string,
  payload: BoardWindowRenderPayload,
): void {
  payloadCache.set(cacheKey, payload);
  lastFetchTokenByKey.set(cacheKey, fetchToken);
}

export function patchBoardPayloadCacheDataContext(
  cacheKey: string,
  dataContext: Record<string, unknown>,
): void {
  const cached = payloadCache.get(cacheKey);
  if (!cached) {
    return;
  }
  payloadCache.set(cacheKey, { ...cached, dataContext });
}

/**
 * 동일 cacheKey 동시 요청 단일화 — 더블탭·빠른 재진입 시 posts/post API 중복 방지.
 */
export function runBoardPayloadInflight(
  cacheKey: string,
  loader: () => Promise<BoardWindowRenderPayload>,
): Promise<BoardWindowRenderPayload> {
  const existing = inflightLoads.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = loader().finally(() => {
    if (inflightLoads.get(cacheKey) === promise) {
      inflightLoads.delete(cacheKey);
    }
  });
  inflightLoads.set(cacheKey, promise);
  return promise;
}

/** 게시글 상세·답글 목록 등 — 해당 postId 캐시 무효화 (답글 작성 후 원글 재진입) */
export function invalidateBoardPayloadCacheForPost(slug: string, postId: string | number): void {
  const id = String(postId).trim();
  if (!slug || !id) {
    return;
  }
  const prefix = `${slug}:${id}:`;
  for (const key of [...payloadCache.keys()]) {
    if (key.startsWith(prefix)) {
      payloadCache.delete(key);
      lastFetchTokenByKey.delete(key);
      inflightLoads.delete(key);
    }
  }
}

/** 게시판 목록(index) 캐시 무효화 — 글 작성·수정 후 목록 재진입 시 stale 방지 */
export function invalidateBoardPayloadCacheForList(slug: string): void {
  if (!slug) {
    return;
  }
  const prefix = `${slug}::`;
  for (const key of [...payloadCache.keys()]) {
    if (key.startsWith(prefix)) {
      payloadCache.delete(key);
      lastFetchTokenByKey.delete(key);
      inflightLoads.delete(key);
    }
  }
}

export function clearBoardPayloadCacheForTests(): void {
  payloadCache.clear();
  lastFetchTokenByKey.clear();
  inflightLoads.clear();
}
