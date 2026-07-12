import { fetchChatConversations } from '../api/moabomChatApi';
import {
  fetchShellNotifications,
  fetchShellUnreadCount,
  type ShellNotificationItem,
} from '../api/moabomShellNotificationsApi';
import {
  getShellNotificationCache,
  setShellNotificationCache,
} from '../shell/moabomShellNotificationBridge';
import { setShellChatInboxCache } from '../shell/moabomShellChatInboxCache';
import { dispatchShellNotificationReceived } from '../shell/ShellRealtimeStore';
import { dispatchShellUnreadSynced } from '../shell/moabomShellUnreadBadge';
import type { ShellNotificationReceivedPayload } from './moabomShellNotificationSocket';
import { isMoabomWebSocketConnected, subscribeMoabomWebSocketConnectionChange } from './moabomWebSocketConnection';
import { runMoabomShellRealtimeTask } from './moabomShellRealtimeRequestCoalescer';

/** WS 끊김 시 인박스 REST 동기화 간격 */
export const MOABOM_CHAT_INBOX_SYNC_FAST_MS = 8_000;
/** WS 끊김 시 알림 목록·unread 안전망 */
export const MOABOM_NOTIFICATION_LIST_SAFETY_DISCONNECTED_MS = 30_000;

export { MOABOM_SHELL_UNREAD_SYNCED_EVENT } from '../shell/moabomShellUnreadBadge';

let syncInstalled = false;
let syncActive = false;
let focusCatchUpInstalled = false;
let inboxSyncInFlight = false;
let notificationSyncInFlight = false;
let fastInboxTimer: ReturnType<typeof setInterval> | null = null;
let listSafetyTimer: ReturnType<typeof setInterval> | null = null;

function notificationItemToPayload(item: ShellNotificationItem): ShellNotificationReceivedPayload {
  return {
    id: item.id,
    type: item.type,
    subject: item.subject ?? undefined,
    body: item.body ?? undefined,
    url: item.url ?? undefined,
    data: item.data ?? null,
  };
}

function dispatchUnreadSynced(count: number): void {
  dispatchShellUnreadSynced(count);
}

async function syncInboxFromRest(): Promise<void> {
  if (inboxSyncInFlight) {
    return;
  }
  inboxSyncInFlight = true;
  try {
    const rows = await runMoabomShellRealtimeTask(
      'chat:inbox',
      () => fetchChatConversations(),
      { minIntervalMs: 750 },
    );
    setShellChatInboxCache(rows);
  } catch {
    // REST 실패 시 기존 캐시 유지
  } finally {
    inboxSyncInFlight = false;
  }
}

async function syncNotificationListFromRest(forceDispatch = false): Promise<void> {
  const result = await runMoabomShellRealtimeTask(
    'notifications:list:first-page',
    () => fetchShellNotifications(1, 20),
    { minIntervalMs: 750 },
  );
  if (!result.ok || !result.page) {
    return;
  }

  const knownIds = new Set(getShellNotificationCache().map(row => row.id));
  if (!forceDispatch && knownIds.size === 0 && result.page.items.length > 0) {
    setShellNotificationCache(result.page.items);
    return;
  }

  const fresh = result.page.items.filter(item => !knownIds.has(item.id));
  fresh.reverse().forEach(item => {
    dispatchShellNotificationReceived(notificationItemToPayload(item));
  });
}

async function syncNotificationsFromRest(): Promise<void> {
  if (notificationSyncInFlight) {
    return;
  }
  notificationSyncInFlight = true;
  try {
    const count = await runMoabomShellRealtimeTask(
      'notifications:unread-count',
      () => fetchShellUnreadCount(),
      { minIntervalMs: 750 },
    );
    dispatchUnreadSynced(count);
    await syncNotificationListFromRest(true);
  } catch {
    // 알림 동기화 실패는 다음 주기에 재시도
  } finally {
    notificationSyncInFlight = false;
  }
}

async function runCatchUpSync(): Promise<void> {
  await Promise.all([syncInboxFromRest(), syncNotificationsFromRest()]);
}

function clearTimers(): void {
  if (fastInboxTimer !== null) {
    clearInterval(fastInboxTimer);
    fastInboxTimer = null;
  }
  if (listSafetyTimer !== null) {
    clearInterval(listSafetyTimer);
    listSafetyTimer = null;
  }
}

/**
 * WS 연결 중에는 REST 폴링 없음. 끊김 시에만 인박스·알림 안전망.
 */
function scheduleDisconnectedPolling(): void {
  clearTimers();
  if (!syncActive || isMoabomWebSocketConnected()) {
    return;
  }

  fastInboxTimer = setInterval(() => {
    if (!isMoabomWebSocketConnected()) {
      void syncInboxFromRest();
    }
  }, MOABOM_CHAT_INBOX_SYNC_FAST_MS);

  listSafetyTimer = setInterval(() => {
    if (!isMoabomWebSocketConnected()) {
      void syncNotificationsFromRest();
    }
  }, MOABOM_NOTIFICATION_LIST_SAFETY_DISCONNECTED_MS);
}

function installFocusCatchUp(): void {
  if (focusCatchUpInstalled || typeof window === 'undefined') {
    return;
  }
  focusCatchUpInstalled = true;

  const onVisibleOrFocus = () => {
    if (!syncActive) {
      return;
    }
    if (document.visibilityState === 'hidden') {
      return;
    }
    void runCatchUpSync();
  };

  window.addEventListener('focus', onVisibleOrFocus);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      onVisibleOrFocus();
    }
  });
}

/**
 * 로그인 셸 — WS 우선. REST는 끊김·재연결·focus/visibility·패널 진입 시에만.
 */
export function startMoabomShellChatSyncService(): void {
  if (!syncInstalled) {
    syncInstalled = true;
    installFocusCatchUp();
    subscribeMoabomWebSocketConnectionChange(() => {
      if (!syncActive) {
        return;
      }
      scheduleDisconnectedPolling();
      if (isMoabomWebSocketConnected()) {
        void runCatchUpSync();
      }
    });
  }

  if (syncActive) {
    return;
  }
  syncActive = true;
  scheduleDisconnectedPolling();
  void runCatchUpSync();
}

export function stopMoabomShellChatSyncService(): void {
  syncActive = false;
  clearTimers();
}

/** 포커스·가시성 복귀 등 — 셸 인박스 REST 1회 동기화 */
export function requestShellChatInboxSync(): void {
  if (syncActive) {
    void syncInboxFromRest();
  }
}

/** 알림·인박스 동시 catch-up (패널 오픈·외부 트리거) */
export function requestShellChatCatchUpSync(): void {
  if (syncActive) {
    void runCatchUpSync();
  }
}

export function resetMoabomShellChatSyncServiceForTest(): void {
  stopMoabomShellChatSyncService();
  syncInstalled = false;
  focusCatchUpInstalled = false;
  inboxSyncInFlight = false;
  notificationSyncInFlight = false;
}
