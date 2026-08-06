import type { ChatConversation } from '../api/moabomChatApi';
import type { ShellNotificationItem } from '../api/moabomShellNotificationsApi';
import { requestShellJson } from '../api/moabomShellHttp';
import { setShellNotificationCache } from '../shell/moabomShellNotificationBridge';
import { setShellChatInboxCache } from '../shell/moabomShellChatInboxCache';
import { dispatchShellUnreadSynced } from '../shell/moabomShellUnreadBadge';
import { getShellAccessScopeKey } from '../api/moabomShellAccess';
import { isMoabomWebSocketConnected, subscribeMoabomWebSocketConnectionChange } from './moabomWebSocketConnection';
import { runMoabomShellRealtimeTask } from './moabomShellRealtimeRequestCoalescer';
import { isMoabomShellPresenceRealtimeDemanded } from './moabomShellRealtimePresenceDemand';

/** WS 끊김 시 통합 catch-up 최초 재시도 */
export const MOABOM_CHAT_INBOX_SYNC_FAST_MS = 15_000;
/** WS 끊김 장기 backoff 상한 */
export const MOABOM_NOTIFICATION_LIST_SAFETY_DISCONNECTED_MS = 60_000;
export const MOABOM_REALTIME_STATE_SYNCED_EVENT = 'moabom-realtime-state-synced';

export { MOABOM_SHELL_UNREAD_SYNCED_EVENT } from '../shell/moabomShellUnreadBadge';

let syncInstalled = false;
let syncActive = false;
let focusCatchUpInstalled = false;
let syncInFlight: { requestKey: string; promise: Promise<void> } | null = null;
let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
let fallbackAttempt = 0;
let hasObservedConnectedSession = false;

export type MoabomRealtimeState = {
  event_id?: string;
  revision?: number;
  occurred_at?: string;
  notifications?: {
    unread_count?: number;
    items?: ShellNotificationItem[];
  };
  chat?: {
    conversations?: ChatConversation[];
  };
  presence?: Record<string, unknown>;
};

function applyRealtimeState(state: MoabomRealtimeState): void {
  if (Array.isArray(state.notifications?.items)) {
    setShellNotificationCache(state.notifications.items);
  }
  if (typeof state.notifications?.unread_count === 'number') {
    dispatchShellUnreadSynced(state.notifications.unread_count);
  }
  if (Array.isArray(state.chat?.conversations)) {
    setShellChatInboxCache(state.chat.conversations);
  }
  window.dispatchEvent(new CustomEvent<MoabomRealtimeState>(
    MOABOM_REALTIME_STATE_SYNCED_EVENT,
    { detail: state },
  ));
}

async function runCatchUpSync(): Promise<void> {
  const accessScopeKey = getShellAccessScopeKey();
  const domains = [
    'notifications',
    'chat',
    ...(isMoabomShellPresenceRealtimeDemanded() ? ['presence'] : []),
  ];
  const domainKey = domains.join(',');
  const requestKey = `${accessScopeKey}:${domainKey}`;
  if (syncInFlight?.requestKey === requestKey) {
    return syncInFlight.promise;
  }
  const promise = (async () => {
    try {
      const state = await runMoabomShellRealtimeTask(
        `realtime:state:${requestKey}`,
        () => requestShellJson<MoabomRealtimeState>(
          `/api/modules/moabom-system/user/realtime-state?domains=${encodeURIComponent(domainKey)}`,
          'required',
        ),
        { minIntervalMs: 2_000 },
      );
      if (accessScopeKey === getShellAccessScopeKey()) {
        applyRealtimeState(state);
      }
    } catch {
      // 장애 fallback 실패는 다음 backoff에서 재시도
    }
  })().finally(() => {
    if (syncInFlight?.promise === promise) {
      syncInFlight = null;
    }
  });
  syncInFlight = { requestKey, promise };
  return promise;
}

function clearFallbackTimer(): void {
  if (fallbackTimer !== null) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
}

function scheduleDisconnectedCatchUp(immediate = false): void {
  clearFallbackTimer();
  if (!syncActive || isMoabomWebSocketConnected()) {
    fallbackAttempt = 0;
    return;
  }

  const delays = [
    MOABOM_CHAT_INBOX_SYNC_FAST_MS,
    30_000,
    MOABOM_NOTIFICATION_LIST_SAFETY_DISCONNECTED_MS,
  ];
  const delay = immediate ? 0 : delays[Math.min(fallbackAttempt, delays.length - 1)];
  fallbackTimer = setTimeout(() => {
    fallbackTimer = null;
    if (!syncActive || isMoabomWebSocketConnected()) {
      return;
    }
    void runCatchUpSync().finally(() => {
      fallbackAttempt += 1;
      scheduleDisconnectedCatchUp(false);
    });
  }, delay);
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
    // transport connected여도 Reverb publish/auth가 깨진 zombie 연결일 수 있으므로
    // 화면 복귀 시 coalesced 통합 상태를 1회 권위 동기화합니다.
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
      if (isMoabomWebSocketConnected()) {
        const isReconnect = hasObservedConnectedSession;
        hasObservedConnectedSession = true;
        clearFallbackTimer();
        fallbackAttempt = 0;
        if (isReconnect) {
          void runCatchUpSync();
        }
        return;
      }
      scheduleDisconnectedCatchUp(true);
    });
  }

  if (syncActive) {
    return;
  }
  syncActive = true;
  hasObservedConnectedSession = isMoabomWebSocketConnected();
  if (!hasObservedConnectedSession) {
    // 정상 부트의 WS 연결 대기 구간은 장애가 아니다. fast backoff 뒤에도 끊긴 경우만 복구한다.
    scheduleDisconnectedCatchUp(false);
  }
}

export function stopMoabomShellChatSyncService(): void {
  syncActive = false;
  hasObservedConnectedSession = false;
  clearFallbackTimer();
  fallbackAttempt = 0;
}

/** 호환 API — WS 장애일 때만 통합 상태 1회 동기화 */
export function requestShellChatInboxSync(): void {
  if (syncActive && !isMoabomWebSocketConnected()) {
    void runCatchUpSync();
  }
}

/** 알림·인박스·Presence 통합 catch-up */
export function requestShellChatCatchUpSync(): void {
  if (syncActive) {
    void runCatchUpSync();
  }
}

export function resetMoabomShellChatSyncServiceForTest(): void {
  stopMoabomShellChatSyncService();
  syncInstalled = false;
  focusCatchUpInstalled = false;
  syncInFlight = null;
  hasObservedConnectedSession = false;
}
