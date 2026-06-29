import {
  invalidateBoardPayloadCacheForList,
  invalidateBoardPayloadCacheForPost,
} from '../shell/boardWindowPayloadCache';

function isTruthy(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export async function invalidateBoardShellPostCacheHandler(
  action: { params?: Record<string, unknown> },
): Promise<void> {
  const slug = String(action.params?.slug ?? '').trim();
  if (!slug) {
    return;
  }

  const rawPostId = action.params?.postId;
  if (rawPostId != null && String(rawPostId).trim() !== '') {
    invalidateBoardPayloadCacheForPost(slug, rawPostId);
  }

  if (isTruthy(action.params?.invalidateIndex)) {
    invalidateBoardPayloadCacheForList(slug);
  }
}
