import { moabomApiPut } from '../api/moabomAuthenticatedApi';
import { sanitizeMainAppOrderIds, saveLocalMainAppOrder } from '../pages/home/moaHomeShellOrder';

let inflight: Promise<void> | null = null;
let pendingOrder: string[] | null = null;
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

async function drainQueue(): Promise<void> {
  while (pendingOrder !== null) {
    const next = pendingOrder;
    pendingOrder = null;

    try {
      await moabomApiPut('/api/modules/moabom-system/user/settings', {
        shell: {
          home: {
            mainAppOrder: next,
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

export function queueSaveShellMainAppOrder(order: string[], isLoggedIn: boolean): Promise<void> {
  if (!isLoggedIn) {
    return Promise.resolve();
  }

  pendingOrder = sanitizeMainAppOrderIds(order);

  if (inflight) {
    return inflight;
  }

  inflight = drainQueue().finally(() => {
    inflight = null;
  });

  return inflight;
}

export function persistMainAppOrder(order: string[], input: { isLoggedIn: boolean }): void {
  const sanitized = sanitizeMainAppOrderIds(order);
  saveLocalMainAppOrder(sanitized);

  if (input.isLoggedIn) {
    void queueSaveShellMainAppOrder(sanitized, true);
  }
}

/** @internal */
export function __resetMoabomShellOrderSaveQueueForTest(): void {
  inflight = null;
  pendingOrder = null;
  lastResolveAt = 0;
}
