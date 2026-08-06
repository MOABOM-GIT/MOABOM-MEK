import { subscribeChatInbox } from './moabomChatSocket';
import {
  dispatchShellChatInboxUpdated,
  dispatchShellNotificationReceived,
} from '../shell/ShellRealtimeStore';
import {
  isMoabomPrivateChannelSubscribed,
  isMoabomWebSocketConnected,
  subscribeMoabomWebSocketConnectionChange,
} from './moabomWebSocketConnection';
import { MOABOM_WEBSOCKET_AUTH_SYNCED_EVENT } from './moabomWebSocketAuthSync';
import {
  subscribeShellNotificationChannel,
  shellNotificationChannelName,
  type ShellNotificationSubscription,
} from './moabomShellNotificationSocket';
import {
  acknowledgeRealtimeReachabilityChallenge,
  requestRealtimeReachabilityChallenge,
} from './moabomRealtimeReachability';

const RESYNC_DEBOUNCE_MS = 400;
const SUBSCRIPTION_RETRY_BASE_MS = 250;
const SUBSCRIPTION_RETRY_MAX_MS = 5_000;
const SUBSCRIPTION_RETRY_MAX_ATTEMPTS = 24;
const REACHABILITY_CHALLENGE_REFRESH_MS = 120_000;

let activeUserUuid: string | null = null;
let notificationSubscription: ShellNotificationSubscription | null = null;
let chatInboxSubscription: { unsubscribe: () => void } | null = null;
let coordinatorInstalled = false;
let resyncTimer: ReturnType<typeof setTimeout> | null = null;
let subscriptionRetryTimer: ReturnType<typeof setTimeout> | null = null;
let reachabilityChallengeTimer: ReturnType<typeof setTimeout> | null = null;
let subscriptionRetryAttempt = 0;
let lastConnectionState: string | null = null;

function clearSubscriptionRetryTimer(): void {
  if (subscriptionRetryTimer !== null) {
    clearTimeout(subscriptionRetryTimer);
    subscriptionRetryTimer = null;
  }
}

function subscriptionsReady(): boolean {
  if (!notificationSubscription || !chatInboxSubscription) {
    return false;
  }
  if (!isMoabomWebSocketConnected() || !activeUserUuid) {
    return true;
  }
  return isMoabomPrivateChannelSubscribed(shellNotificationChannelName(activeUserUuid));
}

function clearReachabilityChallengeTimer(): void {
  if (reachabilityChallengeTimer !== null) {
    clearTimeout(reachabilityChallengeTimer);
    reachabilityChallengeTimer = null;
  }
}

function scheduleReachabilityChallenge(immediate = false): void {
  if (
    !activeUserUuid
    || !isMoabomWebSocketConnected()
    || !subscriptionsReady()
  ) {
    clearReachabilityChallengeTimer();
    return;
  }
  if (reachabilityChallengeTimer !== null) {
    return;
  }

  reachabilityChallengeTimer = setTimeout(() => {
    reachabilityChallengeTimer = null;
    void requestRealtimeReachabilityChallenge()
      .finally(() => scheduleReachabilityChallenge(false));
  }, immediate ? 0 : REACHABILITY_CHALLENGE_REFRESH_MS);
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
    if (subscriptionRetryAttempt % 4 === 0) {
      teardownUserChannelSubscriptions(false);
    }
    ensureUserChannelSubscriptions(activeUserUuid);
    if (!subscriptionsReady()) {
      scheduleSubscriptionRetry();
    } else {
      subscriptionRetryAttempt = 0;
      scheduleReachabilityChallenge(true);
    }
  }, delayMs);
}

function teardownUserChannelSubscriptions(resetRetryAttempt = true): void {
  clearSubscriptionRetryTimer();
  clearReachabilityChallengeTimer();
  if (resetRetryAttempt) {
    subscriptionRetryAttempt = 0;
  }
  if (notificationSubscription) {
    notificationSubscription.unsubscribe();
    notificationSubscription = null;
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

  if (!notificationSubscription) {
    const subscription = subscribeShellNotificationChannel(
      userUuid,
      payload => {
        dispatchShellNotificationReceived(payload);
      },
      payload => {
        void acknowledgeRealtimeReachabilityChallenge(payload);
      },
    );
    if (subscription) {
      notificationSubscription = subscription;
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
    scheduleReachabilityChallenge(true);
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
  // 설치 시점의 실제 상태를 baseline으로 삼아 첫 connected snapshot을 재연결로 오인하지 않는다.
  lastConnectionState = isMoabomWebSocketConnected() ? 'connected' : 'disconnected';

  window.addEventListener(MOABOM_WEBSOCKET_AUTH_SYNCED_EVENT, () => {
    scheduleResyncMoabomShellRealtimeSubscriptions();
  });

  subscribeMoabomWebSocketConnectionChange(() => {
    const state = isMoabomWebSocketConnected() ? 'connected' : 'disconnected';
    const becameConnected = state === 'connected' && lastConnectionState === 'disconnected';
    lastConnectionState = state;
    if (becameConnected) {
      scheduleResyncMoabomShellRealtimeSubscriptions();
    }
    if (activeUserUuid && !subscriptionsReady()) {
      scheduleSubscriptionRetry();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      scheduleReachabilityChallenge(true);
    }
  });
}

export function resetMoabomShellRealtimeCoordinatorForTest(): void {
  stopMoabomShellRealtimeCoordinator();
  coordinatorInstalled = false;
  lastConnectionState = null;
}
