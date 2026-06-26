export type ShellNotificationReceivedPayload = {
  subject?: string;
  body?: string;
  type?: string;
  id?: string;
  url?: string;
  data?: Record<string, unknown> | null;
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
): string | null {
  const ws = getWebSocketApi();
  if (!ws?.subscribe) {
    return null;
  }

  const subscriptionKey = ws.subscribe(
    shellNotificationChannelName(userUuid),
    'notification.received',
    (raw: unknown) => {
      const payload = (raw && typeof raw === 'object' ? raw : {}) as ShellNotificationReceivedPayload;
      onReceived(payload);
    },
    { channelType: 'private' },
  );

  return subscriptionKey || null;
}

export function unsubscribeShellNotificationChannel(subscriptionKey: string): void {
  if (!subscriptionKey) {
    return;
  }
  getWebSocketApi()?.unsubscribe?.(subscriptionKey);
}
