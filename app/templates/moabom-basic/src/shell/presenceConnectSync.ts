import type { PresenceOnlineUser } from '../api/moabomPresenceApi';

const SESSION_KEY_STORAGE = 'moabom_presence_last_session_key';

export function rememberPresenceSessionKey(sessionKey: string | undefined | null): void {
  if (!sessionKey || typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(SESSION_KEY_STORAGE, sessionKey);
  } catch {
    // ignore quota / private mode
  }
}

export function getRememberedPresenceSessionKey(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return localStorage.getItem(SESSION_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function shouldRefreshConnectListAfterHeartbeat(result: {
  accepted?: boolean;
  session_key?: string;
}): boolean {
  return result.accepted !== false && !!result.session_key;
}

/**
 * 접속자 API·revision 이벤트 후 최종 방어 — guest는 visitor_id(없으면 session_key), 회원은 user_uuid 기준 1행.
 */
export function normalizePresenceConnectList(users: PresenceOnlineUser[]): PresenceOnlineUser[] {
  const guests = new Map<string, PresenceOnlineUser>();
  const authenticated = new Map<string, PresenceOnlineUser>();

  for (const user of users) {
    if (user.user_uuid) {
      const existing = authenticated.get(user.user_uuid);
      if (!existing || comparePresenceRecency(user, existing) > 0) {
        authenticated.set(user.user_uuid, user);
      }
    }
  }

  const authenticatedVisitorIds = new Set(
    [...authenticated.values()]
      .map(user => user.visitor_id?.trim() ?? '')
      .filter(visitorId => visitorId !== ''),
  );

  for (const user of users) {
    if (user.user_uuid) {
      continue;
    }

    const guestVisitorId = user.visitor_id?.trim() ?? '';
    if (guestVisitorId !== '' && authenticatedVisitorIds.has(guestVisitorId)) {
      continue;
    }

    const guestKey = guestVisitorId || user.session_key;
    const existing = guests.get(guestKey);
    if (!existing || comparePresenceRecency(user, existing) > 0) {
      guests.set(guestKey, user);
    }
  }

  return [...guests.values(), ...authenticated.values()]
    .sort((a, b) => comparePresenceRecency(b, a));
}

/**
 * 로그인 직후 — 내 visitor_id guest 행 제거 후 member 1행으로 승격(낙관적).
 */
export function optimisticPromoteSelfInConnectList(
  users: PresenceOnlineUser[],
  visitorId: string,
  selfRow: PresenceOnlineUser,
): PresenceOnlineUser[] {
  const trimmedVisitorId = visitorId.trim();
  const selfUuid = selfRow.user_uuid?.trim() ?? '';

  const withoutShadows = users.filter(user => {
    if (selfUuid !== '' && user.user_uuid === selfUuid) {
      return false;
    }
    if (!user.user_uuid && trimmedVisitorId !== '') {
      const guestVisitorId = user.visitor_id?.trim() ?? '';
      if (guestVisitorId === trimmedVisitorId) {
        return false;
      }
    }
    return true;
  });

  return normalizePresenceConnectList([selfRow, ...withoutShadows]);
}

/**
 * 로그아웃 직후 — 내 member 행만 제거(낙관적). guest 행은 heartbeat 확정까지 유지.
 */
export function optimisticDemoteSelfFromConnectList(
  users: PresenceOnlineUser[],
  userUuid: string,
): PresenceOnlineUser[] {
  const trimmedUuid = userUuid.trim();
  if (trimmedUuid === '') {
    return users;
  }

  return users.filter(user => user.user_uuid !== trimmedUuid);
}

function comparePresenceRecency(a: PresenceOnlineUser, b: PresenceOnlineUser): number {
  const aSeen = a.last_seen_at ?? '';
  const bSeen = b.last_seen_at ?? '';
  if (aSeen !== bSeen) {
    return aSeen.localeCompare(bSeen);
  }
  return a.session_key.localeCompare(b.session_key);
}
