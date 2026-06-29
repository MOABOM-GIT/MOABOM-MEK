/**
 * 최근 사용 셸 앱 청크 선로딩 — tertiary-idle 이후 백그라운드에서 네트워크만 시작한다.
 */

import { hasMoabomShellAppChunk, prefetchMoabomShellAppChunk } from '../apps';
import { STORAGE_KEY_RECENT_APPS } from '../shell/moaShellLayoutConstants';
import { loadJsonSanitizedIds } from '../shell/moaShellLocalStorage';
import { whenMoabomBootPhaseAtLeast } from './moabomShellBootPipeline';

const MAX_IDLE_PREFETCH_APPS = 4;

function prefetchRecentShellAppChunks(): void {
  const recentIds = loadJsonSanitizedIds(STORAGE_KEY_RECENT_APPS, []).slice(0, MAX_IDLE_PREFETCH_APPS);
  for (const appId of recentIds) {
    if (hasMoabomShellAppChunk(appId)) {
      prefetchMoabomShellAppChunk(appId);
    }
  }
}

/** 홈 셸 부트가 여유로워진 뒤 최근 앱 청크 preload 를 예약한다. */
export function schedulePrefetchRecentMoabomShellAppChunks(): void {
  whenMoabomBootPhaseAtLeast('tertiary-idle', () => {
    const run = () => prefetchRecentShellAppChunks();
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 5000 });
      return;
    }
    window.setTimeout(run, 1500);
  });
}

/** Vitest 격리 */
export function __resetRecentShellAppChunkPrefetchForTest(): void {
  // stateless — no-op
}
