import { moabomApiPut } from '../api/moabomAuthenticatedApi';
import { sanitizeMainAppOrderIds, saveLocalMainAppOrder } from '../shell/moaShellAppOrder';
import {
  loadMainUnpinnedGeneratedIds,
  sanitizeMainUnpinnedGeneratedIds,
} from '../shell/moaShellMainAppUnpinned';

export interface ShellHomePersistInput {
  order: string[];
  customized: boolean;
  unpinnedGeneratedIds?: string[];
}

interface PendingShellHome extends ShellHomePersistInput {
  order: string[];
  customized: boolean;
  unpinnedGeneratedIds: string[];
}

let inflight: Promise<void> | null = null;
let pendingShellHome: PendingShellHome | null = null;
let lastResolveAt = 0;

export function isSavingShellOrder(): boolean {
  return inflight !== null;
}

export function isRecentlySavedShellOrder(windowMs = 600): boolean {
  if (inflight !== null) {
    return true;
  }
  if (lastResolveAt === 0) {
    return false;
  }
  return Date.now() - lastResolveAt < windowMs;
}

function normalizeShellHomePayload(input: ShellHomePersistInput): PendingShellHome {
  return {
    order: sanitizeMainAppOrderIds(input.order),
    customized: input.customized,
    unpinnedGeneratedIds: sanitizeMainUnpinnedGeneratedIds(
      input.unpinnedGeneratedIds ?? [...loadMainUnpinnedGeneratedIds()],
    ),
  };
}

async function drainQueue(): Promise<void> {
  while (pendingShellHome !== null) {
    const next = pendingShellHome;
    pendingShellHome = null;

    try {
      await moabomApiPut('/api/modules/moabom-system/user/settings', {
        shell: {
          home: {
            mainAppOrder: next.order,
            mainAppOrderCustomized: next.customized,
            mainUnpinnedGeneratedIds: next.unpinnedGeneratedIds,
          },
        },
      });
    } catch {
      /* UI는 이미 로컬에 반영됨 */
    } finally {
      lastResolveAt = Date.now();
    }
  }
}

export function queueSaveShellHomeSettings(
  input: ShellHomePersistInput,
  isLoggedIn: boolean,
): Promise<void> {
  if (!isLoggedIn) {
    return Promise.resolve();
  }

  pendingShellHome = normalizeShellHomePayload(input);

  if (inflight) {
    return inflight;
  }

  inflight = drainQueue().finally(() => {
    inflight = null;
  });

  return inflight;
}

/** @deprecated `queueSaveShellHomeSettings` 사용 */
export function queueSaveShellMainAppOrder(order: string[], isLoggedIn: boolean): Promise<void> {
  return queueSaveShellHomeSettings({ order, customized: true }, isLoggedIn);
}

export function persistShellHomeSettings(
  input: ShellHomePersistInput,
  options: { isLoggedIn: boolean },
): void {
  const normalized = normalizeShellHomePayload(input);
  if (normalized.customized) {
    saveLocalMainAppOrder(normalized.order);
  }

  if (options.isLoggedIn) {
    void queueSaveShellHomeSettings(normalized, true);
  }
}

export function persistMainAppOrder(
  order: string[],
  input: { isLoggedIn: boolean; customized?: boolean },
): void {
  persistShellHomeSettings(
    { order, customized: input.customized ?? true },
    input,
  );
}

/** @internal */
export function __resetMoabomShellOrderSaveQueueForTest(): void {
  inflight = null;
  pendingShellHome = null;
  lastResolveAt = 0;
}
