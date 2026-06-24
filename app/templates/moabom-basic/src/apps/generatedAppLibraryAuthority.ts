import type { StoredGeneratedAppSummary } from '../api/moabomAppsApi';
import type { App } from '../data/Moa_apps';
import { dedupeAppsById } from '../shell/moaShellAppLists';
import { mapStoredGeneratedAppToLibraryApp } from './generatedAppLibrary';
import {
  clearGeneratedAppLibraryCache,
  saveGeneratedAppLibraryCache,
  upsertOwnedAppInLibraryCache,
} from './generatedAppLibraryCache';

/** 생성앱 라이브러리 API 동기화 상태 — UI는 `ready` 이전에 생성앱을 그리지 않음 */
export type GeneratedLibraryHydration = 'idle' | 'loading' | 'ready' | 'error';

export function resolveGeneratedLibraryScopeKey(
  isLoggedIn: boolean,
  memberKey: string | undefined | null,
): string {
  if (isLoggedIn && memberKey) {
    return `member:${memberKey}`;
  }

  return 'guest';
}

export interface ReconciledGeneratedLibrary {
  owned: App[];
  shared: App[];
  library: App[];
}

/**
 * 서버 목록을 생성앱 라이브러리 SSOT로 반영합니다.
 * - 표시용 App 은 API 응답에서만 생성
 * - localStorage 캐시는 scopeKey 와 함께 write-through (부트스트랩 표시용 아님)
 */
export function reconcileGeneratedLibraryFromServer(input: {
  ownedItems: StoredGeneratedAppSummary[];
  sharedItems: StoredGeneratedAppSummary[];
  scopeKey: string;
}): ReconciledGeneratedLibrary {
  saveGeneratedAppLibraryCache(input.ownedItems, input.sharedItems, input.scopeKey);
  const owned = input.ownedItems.map(mapStoredGeneratedAppToLibraryApp);
  const shared = input.sharedItems.map(mapStoredGeneratedAppToLibraryApp);
  const library = dedupeAppsById([...owned, ...shared]);

  return { owned, shared, library };
}

/** 저장 API 성공 직후 — 목록 재조회 없이 검증된 단건을 라이브러리·캐시에 반영 */
export function commitSavedGeneratedAppToLibrary(
  item: StoredGeneratedAppSummary,
  scopeKey: string,
): App {
  upsertOwnedAppInLibraryCache(item, scopeKey);

  return mapStoredGeneratedAppToLibraryApp(item);
}

export function clearValidatedGeneratedLibraryStorage(): void {
  clearGeneratedAppLibraryCache();
}
