import { createShellModuleApi } from '../api/moabomShellHttp';
import { sanitizeMainAppOrderIds } from '../shell/moaShellAppOrder';

const systemApi = createShellModuleApi('moabom-system');

const SAVE_DEBOUNCE_MS = 400;
const MAX_RECENT_APP_IDS = 10;

let pendingIds: string[] | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let inflight: Promise<void> | null = null;
let lastResolveAt = 0;

export function isRecentlySavedRecentAppIds(windowMs = 600): boolean {
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

  try {
    await systemApi('user/settings', {
      method: 'PUT',
      body: {
        shell: {
          home: {
            recentAppIds: next,
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
  pendingIds = normalizeRecentAppIds(ids);

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
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}
