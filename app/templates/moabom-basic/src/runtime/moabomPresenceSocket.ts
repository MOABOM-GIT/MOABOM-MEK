import { handleShellPresenceRevisionEvent } from '../shell/ShellRealtimeStore';
import type { PresenceFriend } from '../api/moabomPresenceApi';
import { shellNotificationChannelName } from './moabomShellNotificationSocket';

export type PresenceRevisionPayload = {
  tenant_slug: string;
  revision: number;
  reason?: string;
};

export type PresenceFriendsUpdatedPayload = {
  event_id?: string;
  revision?: number;
  occurred_at?: string;
  reason?: string;
  friends?: PresenceFriend[];
};

export type PresenceMemberUpdatedPayload = {
  event_id?: string;
  revision?: number;
  user_uuid?: string;
  display_name?: string;
  avatar?: string | null;
  availability?: 'online' | 'away' | 'busy' | 'offline';
  presence_subtitle?: string | null;
  is_reachable?: boolean;
};

type G7WebSocketApi = {
  subscribe?: (
    channel: string,
    event: string,
    callback: (data: unknown) => void,
    options?: { channelType?: 'public' | 'private' | 'presence' },
  ) => string;
  unsubscribe?: (subscriptionKey: string) => void;
  leaveChannel?: (channel: string) => void;
  manager?: {
    getEcho?: () => {
      join?: (channel: string) => {
        here?: (callback: (members: PresenceMember[]) => void) => unknown;
        joining?: (callback: (member: PresenceMember) => void) => unknown;
        leaving?: (callback: (member: PresenceMember) => void) => unknown;
        error?: (callback: (error: unknown) => void) => unknown;
      };
    } | null;
  };
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

export function subscribePresenceFriendsChannel(
  userUuid: string,
  onUpdated: (payload: PresenceFriendsUpdatedPayload) => void,
): string | null {
  const ws = getWebSocketApi();
  if (!ws?.subscribe || !userUuid) {
    return null;
  }
  const key = ws.subscribe(
    shellNotificationChannelName(userUuid),
    'presence.friends.updated',
    raw => onUpdated(
      (raw && typeof raw === 'object' ? raw : {}) as PresenceFriendsUpdatedPayload,
    ),
    { channelType: 'private' },
  );
  return key || null;
}

export function subscribePresenceMemberStateChannel(
  channel: string,
  onUpdated: (payload: PresenceMemberUpdatedPayload) => void,
): string | null {
  const ws = getWebSocketApi();
  if (!ws?.subscribe || !channel) {
    return null;
  }
  const key = ws.subscribe(
    channel,
    'presence.member.updated',
    raw => onUpdated(
      (raw && typeof raw === 'object' ? raw : {}) as PresenceMemberUpdatedPayload,
    ),
    { channelType: 'presence' },
  );
  return key || null;
}

export type PresenceMember = {
  uuid?: string;
  name?: string;
  avatar?: string | null;
};

export type PresenceSocketSubscription = {
  channel: string;
  leave: () => void;
};

export type PresenceMembershipHandlers = {
  onHere?: (members: PresenceMember[]) => void;
  onJoining?: (member: PresenceMember) => void;
  onLeaving?: (member: PresenceMember) => void;
  onError?: (error: unknown) => void;
};

/**
 * Reverb presence membership를 목록 상태의 push SSOT로 사용합니다.
 * REST online 조회는 최초 패널 snapshot과 WS 장애 catch-up에만 남깁니다.
 */
export function subscribeTenantPresenceChannel(
  channel: string,
  handlers: PresenceMembershipHandlers,
): PresenceSocketSubscription | null {
  const ws = getWebSocketApi();
  const echo = ws?.manager?.getEcho?.();
  const presence = echo?.join?.(channel);
  if (!presence) {
    return null;
  }

  presence.here?.(members => handlers.onHere?.(Array.isArray(members) ? members : []));
  presence.joining?.(member => handlers.onJoining?.(member));
  presence.leaving?.(member => handlers.onLeaving?.(member));
  presence.error?.(error => handlers.onError?.(error));

  return {
    channel,
    leave: () => ws?.leaveChannel?.(channel),
  };
}

export function leaveTenantPresenceChannel(channel: string): void {
  if (channel) {
    getWebSocketApi()?.leaveChannel?.(channel);
  }
}
