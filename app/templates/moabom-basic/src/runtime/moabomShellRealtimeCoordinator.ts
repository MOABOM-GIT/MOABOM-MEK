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
const SUBSCRIPTION_RETRY_BASE_MS = 250;
const SUBSCRIPTION_RETRY_MAX_MS = 5_000;
const SUBSCRIPTION_RETRY_MAX_ATTEMPTS = 24;

let activeUserUuid: string | null = null;
let notificationSubscriptionKey: string | null = null;
let chatInboxSubscription: { unsubscribe: () => void } | null = null;
let coordinatorInstalled = false;
let resyncTimer: ReturnType<typeof setTimeout> | null = null;
let subscriptionRetryTimer: ReturnType<typeof setTimeout> | null = null;
let subscriptionRetryAttempt = 0;
let lastConnectionState: string | null = null;

function clearSubscriptionRetryTimer(): void {
  if (subscriptionRetryTimer !== null) {
    clearTimeout(subscriptionRetryTimer);
    subscriptionRetryTimer = null;
  }
}

function subscriptionsReady(): boolean {
  return Boolean(notificationSubscriptionKey && chatInboxSubscription);
}

function scheduleSubscriptionRetry(): void {
  if (!activeUserUuid || subscriptionsReady()) {
    clearSubscriptionRetryTimer();
    subscriptionRetryAttempt = 0;
    return;
  }
  if (subscriptionRetryTimer !== null || subscriptionRetryAttempt >= SUBSCRIPTION_RETRY_MAX_ATTEMPTS) {
    return;
  }

  const delayMs = Math.min(
    SUBSCRIPTION_RETRY_MAX_MS,
    SUBSCRIPTION_RETRY_BASE_MS * 2 ** Math.min(subscriptionRetryAttempt, 5),
  );
  subscriptionRetryAttempt += 1;
  subscriptionRetryTimer = setTimeout(() => {
    subscriptionRetryTimer = null;
    if (!activeUserUuid) {
      return;
    }
    ensureUserChannelSubscriptions(activeUserUuid);
    if (!subscriptionsReady()) {
      scheduleSubscriptionRetry();
    } else {
      subscriptionRetryAttempt = 0;
    }
  }, delayMs);
}

function teardownUserChannelSubscriptions(): void {
  clearSubscriptionRetryTimer();
  subscriptionRetryAttempt = 0;
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

  if (!subscriptionsReady()) {
    scheduleSubscriptionRetry();
  } else {
    subscriptionRetryAttempt = 0;
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

  if (uuidChanged || !subscriptionsReady()) {
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
    if (activeUserUuid && !subscriptionsReady()) {
      scheduleSubscriptionRetry();
    }
  });
}

export function resetMoabomShellRealtimeCoordinatorForTest(): void {
  stopMoabomShellRealtimeCoordinator();
  coordinatorInstalled = false;
  lastConnectionState = null;
}
