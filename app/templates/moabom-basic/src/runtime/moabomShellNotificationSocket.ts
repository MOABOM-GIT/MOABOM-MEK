import type { RealtimeReachabilityChallengePayload } from './moabomRealtimeReachability';

export type ShellNotificationReceivedPayload = {
  subject?: string;
  body?: string;
  type?: string;
  id?: string;
  url?: string;
  data?: Record<string, unknown> | null;
  /** REST catch-up에서 unread_count를 먼저 동기화한 경우 중복 +1 방지 */
  unreadAlreadySynced?: boolean;
  event_id?: string;
  domain?: 'notification' | string;
  revision?: number;
  occurred_at?: string;
  unread_count?: number;
  authoritative?: boolean;
  changed_id?: string;
  changed_ids?: string[];
  deleted_id?: string;
  all_read?: boolean;
  all_deleted?: boolean;
};

export type ShellNotificationSubscription = {
  unsubscribe: () => void;
};

type G7WebSocketApi = {
  subscribe?: (
    channel: string,
    event: string,
    callback: (data: unknown) => void,
    options?: { channelType?: 'public' | 'private' | 'presence' },
  ) => string;
  unsubscribe?: (subscriptionKey: string) => void;
};

function getWebSocketApi(): G7WebSocketApi | null {
  return (window as { G7Core?: { websocket?: G7WebSocketApi } }).G7Core?.websocket ?? null;
}

export function shellNotificationChannelName(userUuid: string): string {
  return `core.user.notifications.${userUuid}`;
}

/**
 * 로그인 사용자 private 알림 채널을 구독한다.
 * @returns subscription key (unsubscribe 용) 또는 null
 */
export function subscribeShellNotificationChannel(
  userUuid: string,
  onReceived: (payload: ShellNotificationReceivedPayload) => void,
  onChallenge?: (payload: RealtimeReachabilityChallengePayload) => void,
): ShellNotificationSubscription | null {
  const ws = getWebSocketApi();
  if (!ws?.subscribe) {
    return null;
  }

  const keys: string[] = [];
  const receivedKey = ws.subscribe(
    shellNotificationChannelName(userUuid),
    'notification.received',
    (raw: unknown) => {
      const payload = (raw && typeof raw === 'object' ? raw : {}) as ShellNotificationReceivedPayload;
      onReceived(payload);
    },
    { channelType: 'private' },
  );
  if (receivedKey) {
    keys.push(receivedKey);
  }

  const stateKey = ws.subscribe(
    shellNotificationChannelName(userUuid),
    'notification.state',
    (raw: unknown) => {
      const payload = (raw && typeof raw === 'object' ? raw : {}) as ShellNotificationReceivedPayload;
      onReceived({ ...payload, authoritative: true });
    },
    { channelType: 'private' },
  );
  if (stateKey) {
    keys.push(stateKey);
  }

  if (onChallenge) {
    const challengeKey = ws.subscribe(
      shellNotificationChannelName(userUuid),
      'realtime.challenge',
      (raw: unknown) => {
        const payload = (raw && typeof raw === 'object' ? raw : {}) as RealtimeReachabilityChallengePayload;
        onChallenge(payload);
      },
      { channelType: 'private' },
    );
    if (challengeKey) {
      keys.push(challengeKey);
    }
  }

  if (keys.length === 0) {
    return null;
  }

  return {
    unsubscribe: () => keys.forEach(key => ws.unsubscribe?.(key)),
  };
}
