import type { PresenceOnlineUser } from '../api/moabomPresenceApi';

const SESSION_KEY_STORAGE = 'moabom_presence_last_session_key';
const SELF_GUEST_IP_STORAGE = 'moabom_presence_self_guest_ip';

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

/** 로그인 전 guest 행의 마스크 IP — 승격 후 동일 IP shadow 클라 방어용 */
export function rememberSelfGuestIp(ip: string | null | undefined): void {
  const trimmed = ip?.trim() ?? '';
  if (!trimmed || typeof window === 'undefined') {
    return;
  }
  try {
    sessionStorage.setItem(SELF_GUEST_IP_STORAGE, trimmed);
  } catch {
    // ignore
  }
}

export function getRememberedSelfGuestIp(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return sessionStorage.getItem(SELF_GUEST_IP_STORAGE);
  } catch {
    return null;
  }
}

export function clearRememberedSelfGuestIp(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    sessionStorage.removeItem(SELF_GUEST_IP_STORAGE);
  } catch {
    // ignore
  }
}

/** 목록에 내 visitor_id guest 가 있으면 마스크 IP 를 기억한다. */
export function rememberSelfGuestIpFromConnectList(
  users: PresenceOnlineUser[],
  visitorId: string | null | undefined,
): void {
  const trimmed = visitorId?.trim() ?? '';
  if (!trimmed) {
    return;
  }
  const mine = users.find(
    user => !user.user_uuid && (user.visitor_id?.trim() ?? '') === trimmed,
  );
  rememberSelfGuestIp(mine?.client_ip_masked);
}

export function shouldRefreshConnectListAfterHeartbeat(result: {
  accepted?: boolean;
  session_key?: string;
}): boolean {
  return result.accepted !== false && !!result.session_key;
}

export function resolvePresenceConnectRowKey(user: PresenceOnlineUser): string {
  const userUuid = user.user_uuid?.trim() ?? '';
  if (userUuid) {
    return `user:${userUuid}`;
  }
  const visitorId = user.visitor_id?.trim() ?? '';
  if (visitorId) {
    return `visitor:${visitorId}`;
  }
  return `session:${user.session_key}`;
}

/**
 * 접속자 API·revision 이벤트 후 최종 방어 — guest는 visitor_id(없으면 session_key), 회원은 user_uuid 기준 1행.
 */
function promoteViewerToConnectListTop(
  users: PresenceOnlineUser[],
  viewerUuid?: string | null,
): PresenceOnlineUser[] {
  const trimmed = viewerUuid?.trim() ?? '';
  if (trimmed === '') {
    return users;
  }

  const index = users.findIndex(user => user.user_uuid === trimmed);
  if (index <= 0) {
    return users;
  }

  const self = users[index];
  return [self, ...users.slice(0, index), ...users.slice(index + 1)];
}

export function normalizePresenceConnectList(
  users: PresenceOnlineUser[],
  viewerUuid?: string | null,
  viewerMaskedIp?: string | null,
): PresenceOnlineUser[] {
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
  const authenticatedSessionKeys = new Set(
    [...authenticated.values()]
      .map(user => user.session_key?.trim() ?? '')
      .filter(sessionKey => sessionKey !== ''),
  );

  const hideIp = (viewerMaskedIp ?? getRememberedSelfGuestIp())?.trim() ?? '';
  const viewerIsAuthenticated = (viewerUuid?.trim() ?? '') !== '';

  for (const user of users) {
    if (user.user_uuid) {
      continue;
    }

    const guestVisitorId = user.visitor_id?.trim() ?? '';
    if (guestVisitorId !== '' && authenticatedVisitorIds.has(guestVisitorId)) {
      continue;
    }

    const guestSessionKey = user.session_key?.trim() ?? '';
    if (guestSessionKey !== '' && authenticatedSessionKeys.has(guestSessionKey)) {
      continue;
    }

    if (viewerIsAuthenticated && hideIp !== '') {
      const guestIp = user.client_ip_masked?.trim() ?? '';
      if (guestIp !== '' && guestIp === hideIp) {
        continue;
      }
    }

    const guestKey = guestVisitorId || user.session_key;
    const existing = guests.get(guestKey);
    if (!existing || comparePresenceRecency(user, existing) > 0) {
      guests.set(guestKey, user);
    }
  }

  const sorted = [...authenticated.values(), ...guests.values()]
    .sort((a, b) => comparePresenceRecency(b, a));

  return promoteViewerToConnectListTop(sorted, viewerUuid);
}

/**
 * 로그인 직후 — 내 visitor_id·동일 마스크 IP guest 행 제거 후 member 1행으로 승격(낙관적).
 * 서버 touch=login purge + refreshConnectList 가 SSOT, 여기는 즉시 UI만.
 */
export function optimisticPromoteSelfInConnectList(
  users: PresenceOnlineUser[],
  visitorId: string,
  selfRow: PresenceOnlineUser,
): PresenceOnlineUser[] {
  const trimmedVisitorId = visitorId.trim();
  const selfUuid = selfRow.user_uuid?.trim() ?? '';
  const myGuestIp = users
    .find(user => !user.user_uuid && (user.visitor_id?.trim() ?? '') === trimmedVisitorId)
    ?.client_ip_masked
    ?.trim() ?? '';
  if (myGuestIp) {
    rememberSelfGuestIp(myGuestIp);
  }

  const withoutShadows = users.filter(user => {
    if (selfUuid !== '' && user.user_uuid === selfUuid) {
      return false;
    }
    if (!user.user_uuid) {
      const guestVisitorId = user.visitor_id?.trim() ?? '';
      if (trimmedVisitorId !== '' && guestVisitorId === trimmedVisitorId) {
        return false;
      }
      const guestIp = user.client_ip_masked?.trim() ?? '';
      if (myGuestIp !== '' && guestIp === myGuestIp) {
        return false;
      }
    }
    return true;
  });

  return normalizePresenceConnectList([selfRow, ...withoutShadows], selfUuid, myGuestIp || null);
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
