import type { OwnPresenceState, PresenceOnlineUser } from '../api/moabomPresenceApi';
import { getOrCreateShellVisitorId } from './ShellContextBridge';
import {
  getRememberedPresenceSessionKey,
  optimisticDemoteSelfFromConnectList,
  optimisticPromoteSelfInConnectList,
} from './presenceConnectSync';
import {
  getShellAuthUserAvatar,
  getShellAuthUserUuid,
} from '../utils/presenceSettingsSync';

type AuthUserSnapshot = {
  uuid?: string;
  name?: string;
  nickname?: string | null;
};

function readAuthUser(): AuthUserSnapshot | null {
  return (window as {
    G7Core?: { AuthManager?: { getInstance: () => { getUser: () => AuthUserSnapshot | null } } };
  }).G7Core?.AuthManager?.getInstance?.()?.getUser?.() ?? null;
}

export function buildOptimisticSelfOnlineRow(
  own: OwnPresenceState | null,
): PresenceOnlineUser | null {
  const userUuid = getShellAuthUserUuid();
  if (!userUuid) {
    return null;
  }

  const user = readAuthUser();
  const displayName = String(user?.nickname ?? user?.name ?? '').trim() || userUuid;
  const visitorId = getOrCreateShellVisitorId();
  const sessionKey = getRememberedPresenceSessionKey()
    ?? `pending:${visitorId}`;

  return {
    session_key: sessionKey,
    visitor_id: visitorId,
    user_uuid: userUuid,
    display_name: displayName,
    status_text: own?.presence_subtitle ?? null,
    presence_subtitle: own?.presence_subtitle ?? null,
    avatar: getShellAuthUserAvatar(),
    is_authenticated: true,
    availability: own?.availability ?? 'online',
    is_online: own?.is_reachable ?? true,
    friendship: 'none',
    last_seen_at: new Date().toISOString(),
  };
}

export function applyOptimisticLoginToOnlineUsers(
  users: PresenceOnlineUser[],
  own: OwnPresenceState | null,
): PresenceOnlineUser[] {
  const selfRow = buildOptimisticSelfOnlineRow(own);
  if (!selfRow) {
    return users;
  }

  return optimisticPromoteSelfInConnectList(
    users,
    getOrCreateShellVisitorId(),
    selfRow,
  );
}

export function applyOptimisticLogoutToOnlineUsers(
  users: PresenceOnlineUser[],
  userUuid: string,
): PresenceOnlineUser[] {
  return optimisticDemoteSelfFromConnectList(users, userUuid);
}
