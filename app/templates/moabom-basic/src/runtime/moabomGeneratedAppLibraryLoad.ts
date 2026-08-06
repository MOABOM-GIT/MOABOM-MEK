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
import { getShellAccessScopeKey } from '../api/moabomShellAccess';
import { runMoabomShellRealtimeTask } from './moabomShellRealtimeRequestCoalescer';

export interface MoabomGeneratedAppLibraryPayload {
  owned: StoredGeneratedAppSummary[];
  shared: StoredGeneratedAppSummary[];
  ownedTotal?: number;
  hasMoreOwned?: boolean;
}

let libraryCache: {
  scopeKey: string;
  value: MoabomGeneratedAppLibraryPayload;
} | null = null;
let libraryLoadPromise: {
  scopeKey: string;
  promise: Promise<MoabomGeneratedAppLibraryPayload>;
} | null = null;
let guestSharedPromise: Promise<MoabomGeneratedAppLibraryPayload> | null = null;

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

  const ownedTotal = typeof record.owned_total === 'number' ? record.owned_total : undefined;
  const hasMoreOwned = Boolean(
    record.has_more_owned
    ?? record.owned_truncated
    ?? (ownedTotal != null && ownedTotal > record.owned.length),
  );

  return {
    owned: record.owned,
    shared: record.shared,
    ...(ownedTotal != null ? { ownedTotal } : {}),
    hasMoreOwned,
  };
}

/** user/settings 등 서버 검증 페이로드 — 표시 SSOT는 여전히 reconcile 경유 */
export function seedMoabomGeneratedAppLibrary(raw: unknown): void {
  const normalized = normalizeMoabomGeneratedAppLibraryPayload(raw);
  if (!normalized) {
    return;
  }

  libraryCache = {
    scopeKey: getShellAccessScopeKey(),
    value: normalized,
  };
}

export function invalidateMoabomGeneratedAppLibraryCache(): void {
  libraryCache = null;
  guestSharedPromise = null;
  // libraryLoadPromise 는 유지 — 끊으면 prefetch·catalog 이중 fetch
}

function ensureLoggedInLibraryLoadStarted(): Promise<MoabomGeneratedAppLibraryPayload> {
  const scopeKey = getShellAccessScopeKey();
  if (libraryCache?.scopeKey === scopeKey) {
    return Promise.resolve(libraryCache.value);
  }

  if (libraryLoadPromise?.scopeKey !== scopeKey) {
    const promise = runMoabomShellRealtimeTask(
      `apps:generated-library:${scopeKey}`,
      () => fetchGeneratedAppLibrary().then((payload) => {
        if (scopeKey === getShellAccessScopeKey()) {
          libraryCache = { scopeKey, value: payload };
        }
        return payload;
      }),
      { minIntervalMs: 2_000 },
    );
    const entry = { scopeKey, promise };
    libraryLoadPromise = entry;
    const clearEntry = () => {
      if (libraryLoadPromise === entry) {
        libraryLoadPromise = null;
      }
    };
    void promise.then(clearEntry, clearEntry);
  }

  return libraryLoadPromise.promise;
}

/** auth-ready 이후 — memberKey 확정 전 sync prefetch 와 catalog invalidate 경합 방지 */
export function prefetchMoabomGeneratedAppLibrary(): void {
  const scopeKey = getShellAccessScopeKey();
  if (
    !hasShellAccessToken()
    || libraryCache?.scopeKey === scopeKey
    || libraryLoadPromise?.scopeKey === scopeKey
  ) {
    return;
  }

  void ensureLoggedInLibraryLoadStarted();
}

/**
 * 부트 파이프라인 catalog-critical 단계 — 선행 prefetch 완료를 기다린다.
 * 토큰 없으면 즉시 resolve.
 */
export async function awaitMoabomGeneratedAppLibraryPrefetch(): Promise<void> {
  if (!hasShellAccessToken()) {
    return;
  }

  try {
    await ensureLoggedInLibraryLoadStarted();
  } catch {
    // catalog-critical 은 library 실패여도 진행(React 훅이 재시도)
  }
}

export async function loadMoabomGeneratedAppLibrary(
  isLoggedIn: boolean,
): Promise<MoabomGeneratedAppLibraryPayload> {
  if (!isLoggedIn) {
    // 게스트 shared 는 tertiary 이후에만 — 콜드 부트 PHP 큐에서 summary/attachment 와 경합하지 않음
    if (libraryCache?.scopeKey === 'guest') {
      return libraryCache.value;
    }
    if (!guestSharedPromise) {
      guestSharedPromise = runMoabomShellRealtimeTask(
        'apps:generated-shared:guest',
        async () => {
          const { whenMoabomBootPhaseAtLeast } = await import('./moabomShellBootPipeline');
          await new Promise<void>((resolve) => {
            whenMoabomBootPhaseAtLeast('tertiary-idle', () => resolve());
          });
          const shared = await fetchSharedGeneratedApps();
          const payload = { owned: [] as StoredGeneratedAppSummary[], shared, hasMoreOwned: false };
          libraryCache = { scopeKey: 'guest', value: payload };
          return payload;
        },
        { minIntervalMs: 1_000 },
      ).finally(() => {
        guestSharedPromise = null;
      });
    }
    return guestSharedPromise;
  }

  return ensureLoggedInLibraryLoadStarted();
}

export function __resetMoabomGeneratedAppLibraryLoadForTest(): void {
  invalidateMoabomGeneratedAppLibraryCache();
  guestSharedPromise = null;
  libraryLoadPromise = null;
}
