import { createShellModuleApi } from '../api/moabomShellHttp';
import { sanitizeMainAppOrderIds } from '../shell/moaShellAppOrder';
import { getShellAccessScopeKey } from '../api/moabomShellAccess';

const systemApi = createShellModuleApi('moabom-system');

const SAVE_DEBOUNCE_MS = 400;
const MAX_RECENT_APP_IDS = 10;

let pendingIds: { ids: string[]; accessScopeKey: string } | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let inflight: Promise<void> | null = null;
let lastResolveAt = 0;
let recentAccessScopeKey = 'guest';

export function isRecentlySavedRecentAppIds(windowMs = 600): boolean {
  if (recentAccessScopeKey !== getShellAccessScopeKey()) {
    return false;
  }
  if (inflight !== null || debounceTimer !== null) {
    return true;
  }
  if (lastResolveAt === 0) {
    return false;
  }
  return Date.now() - lastResolveAt < windowMs;
}

function normalizeRecentAppIds(ids: string[]): string[] {
  return sanitizeMainAppOrderIds(ids).slice(0, MAX_RECENT_APP_IDS);
}

async function drainRecentAppIdsQueue(): Promise<void> {
  if (pendingIds === null) {
    return;
  }

  const next = pendingIds;
  pendingIds = null;
  if (next.accessScopeKey !== getShellAccessScopeKey()) {
    return;
  }

  try {
    await systemApi('user/settings', {
      method: 'PUT',
      body: {
        shell: {
          home: {
            recentAppIds: next.ids,
          },
        },
      },
    });
  } catch {
    /* 로컬 recent 는 이미 반영됨 */
  } finally {
    lastResolveAt = Date.now();
  }
}

export function queueSaveRecentAppIds(ids: string[], isLoggedIn: boolean): void {
  const accessScopeKey = getShellAccessScopeKey();
  recentAccessScopeKey = accessScopeKey;
  pendingIds = { ids: normalizeRecentAppIds(ids), accessScopeKey };

  if (!isLoggedIn) {
    return;
  }

  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (inflight) {
      void inflight.finally(() => {
        inflight = drainRecentAppIdsQueue().finally(() => {
          inflight = null;
        });
      });
      return;
    }

    inflight = drainRecentAppIdsQueue().finally(() => {
      inflight = null;
    });
  }, SAVE_DEBOUNCE_MS);
}

/** @internal */
export function __resetMoabomShellRecentAppsSaveQueueForTest(): void {
  pendingIds = null;
  inflight = null;
  lastResolveAt = 0;
  recentAccessScopeKey = 'guest';
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}
