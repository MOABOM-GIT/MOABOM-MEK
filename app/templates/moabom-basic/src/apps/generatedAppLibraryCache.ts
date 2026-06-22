import type { App } from '../data/Moa_apps';
import type { StoredGeneratedAppSummary } from '../api/moabomAppsApi';
import { mapStoredGeneratedAppToLibraryApp } from './generatedAppLibrary';
import { loadJson, saveJson } from '../shell/moaShellLocalStorage';

const STORAGE_KEY = 'moabom-generated-app-library-v1';

export interface GeneratedAppLibraryCache {
  owned: StoredGeneratedAppSummary[];
  shared: StoredGeneratedAppSummary[];
  cachedAt: number;
}

function isSummaryList(value: unknown): value is StoredGeneratedAppSummary[] {
  return Array.isArray(value);
}

/** 마지막으로 성공한 생성앱 목록 — 메인 그리드 즉시 하이드레이션용 */
export function loadGeneratedAppLibraryCache(): GeneratedAppLibraryCache | null {
  const raw = loadJson<GeneratedAppLibraryCache | null>(STORAGE_KEY, null);
  if (!raw || !isSummaryList(raw.owned) || !isSummaryList(raw.shared)) {
    return null;
  }

  return raw;
}

export function saveGeneratedAppLibraryCache(
  owned: StoredGeneratedAppSummary[],
  shared: StoredGeneratedAppSummary[],
): void {
  saveJson(STORAGE_KEY, {
    owned,
    shared,
    cachedAt: Date.now(),
  } satisfies GeneratedAppLibraryCache);
}

/** 삭제된 생성앱을 localStorage 캐시에서 제거 */
export function removeGeneratedAppFromLibraryCache(serverId: number): void {
  const cached = loadGeneratedAppLibraryCache();
  if (!cached) {
    return;
  }

  const owned = cached.owned.filter(item => item.id !== serverId);
  const shared = cached.shared.filter(item => item.id !== serverId);
  if (owned.length === cached.owned.length && shared.length === cached.shared.length) {
    return;
  }

  saveGeneratedAppLibraryCache(owned, shared);
}

/** localStorage 캐시 → 셸 `App` 목록 (메인 그리드 즉시 하이드레이션) */
export function loadCachedGeneratedLibraryApps(): { owned: App[]; shared: App[] } {
  const cached = loadGeneratedAppLibraryCache();

  return {
    owned: (cached?.owned ?? []).map(mapStoredGeneratedAppToLibraryApp),
    shared: (cached?.shared ?? []).map(mapStoredGeneratedAppToLibraryApp),
  };
}
