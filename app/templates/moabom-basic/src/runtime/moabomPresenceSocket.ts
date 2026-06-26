import { handleShellPresenceRevisionEvent } from '../shell/ShellRealtimeStore';

export type PresenceRevisionPayload = {
  tenant_slug: string;
  revision: number;
  reason?: string;
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

/**
 * 테넌트 접속자 revision public 채널 — here/joining/leaving 대신 단일 이벤트로 refetch.
 */
export function subscribePresenceRevisionChannel(
  channel: string,
  onRevision?: (payload: PresenceRevisionPayload) => void,
): string | null {
  const ws = getWebSocketApi();
  if (!ws?.subscribe) {
    return null;
  }

  const subscriptionKey = ws.subscribe(
    channel,
    'presence.revision',
    (raw: unknown) => {
      handleShellPresenceRevisionEvent(raw);
      if (onRevision && raw && typeof raw === 'object') {
        const payload = raw as Partial<PresenceRevisionPayload>;
        if (typeof payload.revision === 'number' && typeof payload.tenant_slug === 'string') {
          onRevision({
            tenant_slug: payload.tenant_slug,
            revision: payload.revision,
            reason: payload.reason,
          });
        }
      }
    },
    { channelType: 'public' },
  );

  return subscriptionKey || null;
}

export function unsubscribePresenceRevisionChannel(subscriptionKey: string): void {
  if (!subscriptionKey) {
    return;
  }
  getWebSocketApi()?.unsubscribe?.(subscriptionKey);
}

/** @deprecated presence.revision public 채널 사용 */
export type PresenceMember = {
  uuid?: string;
  name?: string;
  avatar?: string | null;
};

/** @deprecated presence.revision public 채널 사용 */
export type PresenceSocketSubscription = {
  channel: string;
  leave: () => void;
};

/** @deprecated subscribePresenceRevisionChannel 사용 */
export function subscribeTenantPresenceChannel(): PresenceSocketSubscription | null {
  return null;
}

/** @deprecated */
export function leaveTenantPresenceChannel(): void {
  // no-op — legacy presence channel 제거
}
