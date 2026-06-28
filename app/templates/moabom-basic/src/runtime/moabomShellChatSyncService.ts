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
import type { ShellNotificationReceivedPayload } from './moabomShellNotificationSocket';
import { isMoabomWebSocketConnected, subscribeMoabomWebSocketConnectionChange } from './moabomWebSocketConnection';
import { runMoabomShellRealtimeTask } from './moabomShellRealtimeRequestCoalescer';

/** WS 끊김 시 인박스 REST 동기화 간격 */
export const MOABOM_CHAT_INBOX_SYNC_FAST_MS = 8_000;
/** WS 끊김 시 인박스 안전망 */
export const MOABOM_CHAT_INBOX_SYNC_SAFETY_MS = 30_000;
/** WS 연결 시 인박스 안전망 (이벤트 누락 대비, 간격 완화) */
export const MOABOM_CHAT_INBOX_SYNC_SAFETY_CONNECTED_MS = 60_000;
/** WS 끊김 시 알림·unread REST 동기화 */
export const MOABOM_NOTIFICATION_SYNC_MS = 10_000;
/** WS 연결 시 알림 안전망 (이벤트 누락 대비) */
export const MOABOM_NOTIFICATION_SYNC_SAFETY_CONNECTED_MS = 60_000;

export const MOABOM_SHELL_UNREAD_SYNCED_EVENT = 'moabom-shell-unread-synced';

type UnreadSyncedDetail = { count: number };

let syncInstalled = false;
let syncActive = false;
let lastUnreadCount = 0;
let inboxSyncInFlight = false;
let notificationSyncInFlight = false;
let fastInboxTimer: ReturnType<typeof setInterval> | null = null;
let safetyInboxTimer: ReturnType<typeof setInterval> | null = null;
let notificationTimer: ReturnType<typeof setInterval> | null = null;

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
  lastUnreadCount = count;
  window.dispatchEvent(new CustomEvent<UnreadSyncedDetail>(MOABOM_SHELL_UNREAD_SYNCED_EVENT, {
    detail: { count },
  }));
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
    const previousCount = lastUnreadCount;
    dispatchUnreadSynced(count);

    if (!isMoabomWebSocketConnected() || count > previousCount) {
      const result = await runMoabomShellRealtimeTask(
        'notifications:list:first-page',
        () => fetchShellNotifications(1, 20),
        { minIntervalMs: 750 },
      );
      if (!result.ok || !result.page) {
        return;
      }

      const knownIds = new Set(getShellNotificationCache().map(row => row.id));
      if (knownIds.size === 0 && result.page.items.length > 0) {
        setShellNotificationCache(result.page.items);
        return;
      }

      const fresh = result.page.items.filter(item => !knownIds.has(item.id));
      fresh.reverse().forEach(item => {
        dispatchShellNotificationReceived(notificationItemToPayload(item));
      });
    }
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
  if (safetyInboxTimer !== null) {
    clearInterval(safetyInboxTimer);
    safetyInboxTimer = null;
  }
  if (notificationTimer !== null) {
    clearInterval(notificationTimer);
    notificationTimer = null;
  }
}

function notificationSyncIntervalMs(): number {
  return isMoabomWebSocketConnected()
    ? MOABOM_NOTIFICATION_SYNC_SAFETY_CONNECTED_MS
    : MOABOM_NOTIFICATION_SYNC_MS;
}

function rescheduleNotificationTimer(): void {
  if (notificationTimer !== null) {
    clearInterval(notificationTimer);
    notificationTimer = null;
  }
  if (!syncActive) {
    return;
  }
  notificationTimer = setInterval(() => {
    void syncNotificationsFromRest();
  }, notificationSyncIntervalMs());
}

function safetyInboxIntervalMs(): number {
  return isMoabomWebSocketConnected()
    ? MOABOM_CHAT_INBOX_SYNC_SAFETY_CONNECTED_MS
    : MOABOM_CHAT_INBOX_SYNC_SAFETY_MS;
}

function rescheduleSafetyInboxTimer(): void {
  if (safetyInboxTimer !== null) {
    clearInterval(safetyInboxTimer);
    safetyInboxTimer = null;
  }
  if (!syncActive) {
    return;
  }
  safetyInboxTimer = setInterval(() => {
    void syncInboxFromRest();
  }, safetyInboxIntervalMs());
}

function schedulePolling(): void {
  clearTimers();

  fastInboxTimer = setInterval(() => {
    if (!isMoabomWebSocketConnected()) {
      void syncInboxFromRest();
    }
  }, MOABOM_CHAT_INBOX_SYNC_FAST_MS);

  rescheduleSafetyInboxTimer();
  rescheduleNotificationTimer();
}

/**
 * 로그인 셸 상주 — WS 끊김·재연결 시 인박스·알림 REST catch-up.
 * 채팅 패널 마운트와 무관하게 동작합니다.
 */
export function startMoabomShellChatSyncService(): void {
  if (!syncInstalled) {
    syncInstalled = true;
    subscribeMoabomWebSocketConnectionChange(() => {
      if (!syncActive) {
        return;
      }
      rescheduleSafetyInboxTimer();
      rescheduleNotificationTimer();
      if (isMoabomWebSocketConnected()) {
        void runCatchUpSync();
      }
    });
  }

  if (syncActive) {
    return;
  }
  syncActive = true;
  schedulePolling();
  void runCatchUpSync();
}

export function stopMoabomShellChatSyncService(): void {
  syncActive = false;
  clearTimers();
  lastUnreadCount = 0;
}

/** 포커스·가시성 복귀 등 — 셸 인박스 REST 1회 동기화 */
export function requestShellChatInboxSync(): void {
  if (syncActive) {
    void syncInboxFromRest();
  }
}

/** 알림·인박스 동시 catch-up (패널 외부에서 필요 시) */
export function requestShellChatCatchUpSync(): void {
  if (syncActive) {
    void runCatchUpSync();
  }
}

export function resetMoabomShellChatSyncServiceForTest(): void {
  stopMoabomShellChatSyncService();
  syncInstalled = false;
  inboxSyncInFlight = false;
  notificationSyncInFlight = false;
}
