/**
 * 생성앱 라이브러리 로드 — 서버 검증 SSOT 유지.
 * - B: 토큰 있으면 부트 시 library API 선행 prefetch
 * - A: user/settings 응답에 포함된 `generated_app_library` 시드
 * - C: owned+shared 단일 API (`apps/generated/library`)
 */

import {
  fetchGeneratedAppLibrary,
  fetchSharedGeneratedApps,
  type StoredGeneratedAppSummary,
} from '../api/moabomAppsApi';
import { hasShellAccessToken } from '../api/moabomShellAccess';

export interface MoabomGeneratedAppLibraryPayload {
  owned: StoredGeneratedAppSummary[];
  shared: StoredGeneratedAppSummary[];
}

let libraryCache: MoabomGeneratedAppLibraryPayload | null = null;
let libraryLoadPromise: Promise<MoabomGeneratedAppLibraryPayload> | null = null;

function isSummaryList(value: unknown): value is StoredGeneratedAppSummary[] {
  return Array.isArray(value);
}

export function normalizeMoabomGeneratedAppLibraryPayload(
  raw: unknown,
): MoabomGeneratedAppLibraryPayload | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Record<string, unknown>;
  if (!isSummaryList(record.owned) || !isSummaryList(record.shared)) {
    return null;
  }

  return {
    owned: record.owned,
    shared: record.shared,
  };
}

/** user/settings 등 서버 검증 페이로드 — 표시 SSOT는 여전히 reconcile 경유 */
export function seedMoabomGeneratedAppLibrary(raw: unknown): void {
  const normalized = normalizeMoabomGeneratedAppLibraryPayload(raw);
  if (!normalized) {
    return;
  }

  libraryCache = normalized;
}

export function invalidateMoabomGeneratedAppLibraryCache(): void {
  libraryCache = null;
  libraryLoadPromise = null;
}

function ensureLoggedInLibraryLoadStarted(): Promise<MoabomGeneratedAppLibraryPayload> {
  if (libraryCache) {
    return Promise.resolve(libraryCache);
  }

  if (!libraryLoadPromise) {
    libraryLoadPromise = fetchGeneratedAppLibrary()
      .then((payload) => {
        libraryCache = payload;
        return payload;
      })
      .finally(() => {
        libraryLoadPromise = null;
      });
  }

  return libraryLoadPromise;
}

/** index.ts 부트 — G7 AuthManager 완료 전 library API 선행 */
export function prefetchMoabomGeneratedAppLibrary(): void {
  if (!hasShellAccessToken() || libraryCache || libraryLoadPromise) {
    return;
  }

  void ensureLoggedInLibraryLoadStarted();
}

export async function loadMoabomGeneratedAppLibrary(
  isLoggedIn: boolean,
): Promise<MoabomGeneratedAppLibraryPayload> {
  if (!isLoggedIn) {
    const shared = await fetchSharedGeneratedApps();
    return { owned: [], shared };
  }

  return ensureLoggedInLibraryLoadStarted();
}

export function __resetMoabomGeneratedAppLibraryLoadForTest(): void {
  invalidateMoabomGeneratedAppLibraryCache();
}
