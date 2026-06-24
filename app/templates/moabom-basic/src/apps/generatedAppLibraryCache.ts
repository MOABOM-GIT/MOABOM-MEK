import type { App } from '../data/Moa_apps';
import type { StoredGeneratedAppSummary } from '../api/moabomAppsApi';
import { mapStoredGeneratedAppToLibraryApp } from './generatedAppLibrary';
import { loadJson, saveJson } from '../shell/moaShellLocalStorage';

const STORAGE_KEY = 'moabom-generated-app-library-v2';
const LEGACY_STORAGE_KEY = 'moabom-generated-app-library-v1';

export interface GeneratedAppLibraryCache {
  owned: StoredGeneratedAppSummary[];
  shared: StoredGeneratedAppSummary[];
  cachedAt: number;
  /** member:{memberKey} | guest — 계정·게스트 불일치 시 무시 */
  scopeKey: string;
}

function isSummaryList(value: unknown): value is StoredGeneratedAppSummary[] {
  return Array.isArray(value);
}

function isValidCache(raw: GeneratedAppLibraryCache | null): raw is GeneratedAppLibraryCache {
  return raw != null
    && isSummaryList(raw.owned)
    && isSummaryList(raw.shared)
    && typeof raw.scopeKey === 'string'
    && raw.scopeKey.length > 0;
}

/** 마지막 서버 동기화 스냅샷 (표시 SSOT 아님 — scope 검증·진단용) */
export function loadGeneratedAppLibraryCache(): GeneratedAppLibraryCache | null {
  const raw = loadJson<GeneratedAppLibraryCache | null>(STORAGE_KEY, null);
  if (isValidCache(raw)) {
    return raw;
  }

  return null;
}

export function saveGeneratedAppLibraryCache(
  owned: StoredGeneratedAppSummary[],
  shared: StoredGeneratedAppSummary[],
  scopeKey: string,
): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }

  saveJson(STORAGE_KEY, {
    owned,
    shared,
    cachedAt: Date.now(),
    scopeKey,
  } satisfies GeneratedAppLibraryCache);
}

export function clearGeneratedAppLibraryCache(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

/** 삭제된 생성앱을 캐시에서 제거 */
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

  saveGeneratedAppLibraryCache(owned, shared, cached.scopeKey);
}

/** 저장 API 성공 직후 owned 목록에 단건 upsert */
export function upsertOwnedAppInLibraryCache(
  item: StoredGeneratedAppSummary,
  scopeKey: string,
): void {
  const cached = loadGeneratedAppLibraryCache();
  const owned = cached?.scopeKey === scopeKey
    ? cached.owned.filter(entry => entry.id !== item.id)
    : [];
  const shared = cached?.scopeKey === scopeKey ? cached.shared : [];

  saveGeneratedAppLibraryCache([item, ...owned], shared, scopeKey);
}

/**
 * @deprecated UI 부트스트랩 금지 — `reconcileGeneratedLibraryFromServer` 사용.
 * scope 일치 캐시만 반환 (오프라인·진단용).
 */
export function loadCachedGeneratedLibraryApps(scopeKey: string): { owned: App[]; shared: App[] } {
  const cached = loadGeneratedAppLibraryCache();
  if (!cached || cached.scopeKey !== scopeKey) {
    return { owned: [], shared: [] };
  }

  return {
    owned: cached.owned.map(mapStoredGeneratedAppToLibraryApp),
    shared: cached.shared.map(mapStoredGeneratedAppToLibraryApp),
  };
}
