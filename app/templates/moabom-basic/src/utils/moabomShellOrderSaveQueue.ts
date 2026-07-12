import { createShellModuleApi } from '../api/moabomShellHttp';
import { sanitizeMainAppOrderIds, saveLocalMainAppOrder } from '../shell/moaShellAppOrder';
import {
  loadMainUnpinnedGeneratedIds,
  sanitizeMainUnpinnedGeneratedIds,
} from '../shell/moaShellMainAppUnpinned';

const systemApi = createShellModuleApi('moabom-system');

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

/** PUT 성공 직후 서버 read-after-write 지연을 흡수하는 유예(ms) */
const SHELL_HOME_ACK_GRACE_MS = 2_000;

let inflight: Promise<void> | null = null;
let pendingShellHome: PendingShellHome | null = null;
let lastResolveAt = 0;
/** 로컬 메인 order/unpinned 가 서버에 아직 확정 반영되지 않음 — pull 이 덮어쓰지 못하게 함 */
let shellHomeDirty = false;

export function isSavingShellOrder(): boolean {
  return inflight !== null;
}

/**
 * 로컬 셸 홈 레이아웃이 서버보다 최신이거나 저장 미완료일 때 true.
 * focus/visibility pull 이 미반영 pin 을 롤백하지 않도록 SSOT 로 사용한다.
 */
export function isShellHomeDirty(): boolean {
  if (shellHomeDirty || inflight !== null) {
    return true;
  }
  if (lastResolveAt === 0) {
    return false;
  }
  return Date.now() - lastResolveAt < SHELL_HOME_ACK_GRACE_MS;
}

/** @deprecated `isShellHomeDirty` 사용 — 동일 의미로 유지 */
export function isRecentlySavedShellOrder(windowMs = SHELL_HOME_ACK_GRACE_MS): boolean {
  if (shellHomeDirty || inflight !== null) {
    return true;
  }
  if (lastResolveAt === 0) {
    return false;
  }
  return Date.now() - lastResolveAt < windowMs;
}

export function markShellHomeDirty(): void {
  shellHomeDirty = true;
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

    let saved = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await systemApi('user/settings', {
          method: 'PUT',
          body: {
            shell: {
              home: {
                mainAppOrder: next.order,
                mainAppOrderCustomized: next.customized,
                mainUnpinnedGeneratedIds: next.unpinnedGeneratedIds,
              },
            },
          },
        });
        shellHomeDirty = false;
        lastResolveAt = Date.now();
        saved = true;
        break;
      } catch {
        if (attempt === 0) {
          await new Promise<void>(resolve => {
            setTimeout(resolve, 400);
          });
        }
      }
    }

    if (!saved) {
      /* UI는 이미 로컬에 반영됨 — dirty 유지해 pull 롤백 방지 */
      shellHomeDirty = true;
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

  shellHomeDirty = true;
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
  } else {
    shellHomeDirty = false;
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
  shellHomeDirty = false;
}
