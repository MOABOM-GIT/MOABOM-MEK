import type {
  OwnPresenceState,
  PresenceHeartbeatResult,
  PresenceOnlineUser,
} from '../api/moabomPresenceApi';

const SESSION_KEY_STORAGE = 'moabom_presence_last_session_key';

type AuthUserSnapshot = {
  uuid?: string;
  name?: string;
  nickname?: string;
  avatar?: string | null;
};

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

function getAuthUserSnapshot(): AuthUserSnapshot | null {
  return (window as {
    G7Core?: { AuthManager?: { getInstance: () => { getUser: () => AuthUserSnapshot | null } } };
  }).G7Core?.AuthManager?.getInstance?.()?.getUser?.() ?? null;
}

export function getShellAuthUserDisplayName(fallback: string): string {
  const user = getAuthUserSnapshot();
  const nickname = typeof user?.nickname === 'string' ? user.nickname.trim() : '';
  const name = typeof user?.name === 'string' ? user.name.trim() : '';
  return nickname || name || fallback;
}

export function getShellAuthUserAvatar(): string | null {
  const avatar = getAuthUserSnapshot()?.avatar;
  return typeof avatar === 'string' && avatar !== '' ? avatar : null;
}

export function buildOptimisticSelfOnlineRow(
  guestDisplayName: string,
  ownPresence: OwnPresenceState | null,
  sessionKey?: string | null,
): PresenceOnlineUser | null {
  const userUuid = (window as {
    G7Core?: { AuthManager?: { getInstance: () => { getUser: () => AuthUserSnapshot | null } } };
  }).G7Core?.AuthManager?.getInstance?.()?.getUser?.()?.uuid;

  if (typeof userUuid !== 'string' || userUuid === '') {
    return null;
  }

  const availability = ownPresence?.availability ?? 'online';
  const subtitle = ownPresence?.presence_subtitle ?? null;

  return {
    session_key: sessionKey ?? `optimistic-${userUuid}`,
    user_uuid: userUuid,
    display_name: getShellAuthUserDisplayName(guestDisplayName),
    status_text: subtitle,
    presence_subtitle: subtitle,
    avatar: getShellAuthUserAvatar(),
    is_authenticated: true,
    availability,
    is_online: ownPresence?.is_reachable ?? availability !== 'offline',
    friendship: 'none',
  };
}

/**
 * 로그인 직후 — 이 브라우저의 guest 행을 제거하고 본인 회원 행을 즉시 삽입합니다.
 */
export function promoteGuestToSelfOnConnectList(
  users: PresenceOnlineUser[],
  selfRow: PresenceOnlineUser,
  guestSessionKey: string | null,
): PresenceOnlineUser[] {
  const filtered = users.filter(user => {
    if (user.user_uuid === selfRow.user_uuid) {
      return false;
    }
    if (guestSessionKey && user.session_key === guestSessionKey) {
      return false;
    }
    return true;
  });

  return [selfRow, ...filtered];
}

export function shouldRefreshConnectListAfterHeartbeat(result: PresenceHeartbeatResult): boolean {
  return result.accepted !== false && !!result.session_key;
}
