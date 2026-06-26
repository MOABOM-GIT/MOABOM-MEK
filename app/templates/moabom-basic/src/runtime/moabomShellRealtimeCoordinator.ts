import type { ShellNotificationReceivedPayload } from './moabomShellNotificationSocket';
import { subscribeChatInbox } from './moabomChatSocket';
import {
  dispatchShellChatInboxUpdated,
  dispatchShellNotificationReceived,
} from '../shell/ShellRealtimeStore';
import {
  isMoabomWebSocketConnected,
  subscribeMoabomWebSocketConnectionChange,
} from './moabomWebSocketConnection';
import { MOABOM_WEBSOCKET_AUTH_SYNCED_EVENT } from './moabomWebSocketAuthSync';
import {
  subscribeShellNotificationChannel,
  unsubscribeShellNotificationChannel,
} from './moabomShellNotificationSocket';

const RESYNC_DEBOUNCE_MS = 400;

let activeUserUuid: string | null = null;
let notificationSubscriptionKey: string | null = null;
let chatInboxSubscription: { unsubscribe: () => void } | null = null;
let coordinatorInstalled = false;
let resyncTimer: ReturnType<typeof setTimeout> | null = null;
let lastConnectionState: string | null = null;

function teardownUserChannelSubscriptions(): void {
  if (notificationSubscriptionKey) {
    unsubscribeShellNotificationChannel(notificationSubscriptionKey);
    notificationSubscriptionKey = null;
  }
  if (chatInboxSubscription) {
    chatInboxSubscription.unsubscribe();
    chatInboxSubscription = null;
  }
}

function ensureUserChannelSubscriptions(userUuid: string): void {
  if (!userUuid) {
    return;
  }

  if (!notificationSubscriptionKey) {
    const key = subscribeShellNotificationChannel(userUuid, payload => {
      dispatchShellNotificationReceived(payload);
    });
    if (key) {
      notificationSubscriptionKey = key;
    }
  }

  if (!chatInboxSubscription) {
    const subscription = subscribeChatInbox(userUuid, {
      onInboxUpdated: payload => {
        dispatchShellChatInboxUpdated(payload);
      },
    });
    if (subscription) {
      chatInboxSubscription = subscription;
    }
  }
}

function scheduleResyncMoabomShellRealtimeSubscriptions(): void {
  if (resyncTimer !== null) {
    clearTimeout(resyncTimer);
  }
  resyncTimer = setTimeout(() => {
    resyncTimer = null;
    if (!activeUserUuid) {
      return;
    }
    teardownUserChannelSubscriptions();
    ensureUserChannelSubscriptions(activeUserUuid);
  }, RESYNC_DEBOUNCE_MS);
}

export function resyncMoabomShellRealtimeSubscriptions(): void {
  scheduleResyncMoabomShellRealtimeSubscriptions();
}

export function startMoabomShellRealtimeCoordinator(userUuid: string | null): void {
  if (!userUuid) {
    stopMoabomShellRealtimeCoordinator();
    return;
  }

  const uuidChanged = activeUserUuid !== userUuid;
  activeUserUuid = userUuid;

  if (uuidChanged || !notificationSubscriptionKey || !chatInboxSubscription) {
    teardownUserChannelSubscriptions();
    ensureUserChannelSubscriptions(userUuid);
  }
}

export function stopMoabomShellRealtimeCoordinator(): void {
  activeUserUuid = null;
  if (resyncTimer !== null) {
    clearTimeout(resyncTimer);
    resyncTimer = null;
  }
  teardownUserChannelSubscriptions();
}

/**
 * 로그인 셸 부트 시 1회 설치 — auth 동기화·연결 복구 후 구독 재수립.
 */
export function installMoabomShellRealtimeCoordinator(): void {
  if (coordinatorInstalled || typeof window === 'undefined') {
    return;
  }
  coordinatorInstalled = true;

  window.addEventListener(MOABOM_WEBSOCKET_AUTH_SYNCED_EVENT, () => {
    scheduleResyncMoabomShellRealtimeSubscriptions();
  });

  subscribeMoabomWebSocketConnectionChange(() => {
    const state = isMoabomWebSocketConnected() ? 'connected' : 'disconnected';
    const becameConnected = state === 'connected' && lastConnectionState !== 'connected';
    lastConnectionState = state;
    if (becameConnected) {
      scheduleResyncMoabomShellRealtimeSubscriptions();
    }
  });
}

export function resetMoabomShellRealtimeCoordinatorForTest(): void {
  stopMoabomShellRealtimeCoordinator();
  coordinatorInstalled = false;
  lastConnectionState = null;
}
