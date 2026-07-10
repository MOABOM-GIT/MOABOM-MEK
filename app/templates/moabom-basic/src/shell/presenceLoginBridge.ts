/**
 * 로그인/로그아웃 직후 접속자 목록의 즉시 반영.
 *
 * 서버 SSOT는 `touch=login|logout` heartbeat → `refreshConnectList` 재조회.
 * 이 모듈은 AuthManager 스냅샷이 준비된 경우에만 guest↔회원 1행을 미리 맞춘다.
 * (uuid 없으면 no-op — 서버 재조회가 최종 상태를 채운다.)
 */
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
