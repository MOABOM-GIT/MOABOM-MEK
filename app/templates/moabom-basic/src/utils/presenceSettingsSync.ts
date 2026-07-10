import type {
  OwnPresenceState,
  PresenceAvailability,
  PresenceFriend,
  PresenceOnlineUser,
  PresenceSubtitleMode,
} from '../api/moabomPresenceApi';
import type { MoabomTranslateFn } from '../i18n/moabomT';
import type { PresenceSettingsOptimisticDetail } from '../components/composite/mypage/tabs/useMyPagePresenceSettings';
import { resolvePresenceSubtitle } from './presenceAvailability';

type AuthUserSnapshot = {
  uuid?: string;
  bio?: string | null;
  avatar?: string | null;
};

export type PresenceSubtitleResolveContext = {
  profileBio?: string | null;
  activityText?: string | null;
};

export type LocalPendingPresenceSettings = {
  availability?: PresenceAvailability;
  subtitle_mode?: PresenceSubtitleMode;
  presence_subtitle?: string | null;
};

export function getShellAuthUserUuid(): string | null {
  const user = (window as {
    G7Core?: { AuthManager?: { getInstance: () => { getUser: () => AuthUserSnapshot | null } } };
  }).G7Core?.AuthManager?.getInstance?.()?.getUser?.();

  return typeof user?.uuid === 'string' && user.uuid !== '' ? user.uuid : null;
}

export function getShellAuthUserBio(): string | null {
  const user = (window as {
    G7Core?: { AuthManager?: { getInstance: () => { getUser: () => AuthUserSnapshot | null } } };
  }).G7Core?.AuthManager?.getInstance?.()?.getUser?.();

  const bio = typeof user?.bio === 'string' ? user.bio.trim() : '';
  return bio !== '' ? bio : null;
}

export function getShellAuthUserAvatar(): string | null {
  const user = (window as {
    G7Core?: { AuthManager?: { getInstance: () => { getUser: () => AuthUserSnapshot | null } } };
  }).G7Core?.AuthManager?.getInstance?.()?.getUser?.();

  const avatar = typeof user?.avatar === 'string' ? user.avatar.trim() : '';
  return avatar !== '' ? avatar : null;
}

export function presenceReachableFromAvailability(availability: PresenceAvailability): boolean {
  return availability !== 'offline';
}

export function resolvePresenceSubtitleForMode(
  subtitleMode: PresenceSubtitleMode,
  context: PresenceSubtitleResolveContext,
): string | null {
  switch (subtitleMode) {
    case 'hidden':
      return null;
    case 'profile_bio': {
      const trimmed = (context.profileBio ?? '').trim();
      return trimmed !== '' ? trimmed : null;
    }
    case 'activity': {
      const trimmed = (context.activityText ?? '').trim();
      return trimmed !== '' ? trimmed : null;
    }
    default:
      return null;
  }
}

export function buildOwnPresenceFromSettings(
  detail: PresenceSettingsOptimisticDetail,
  previous: OwnPresenceState | null,
  context: PresenceSubtitleResolveContext,
): OwnPresenceState {
  const availability = detail.availability ?? previous?.availability ?? 'online';
  const subtitleMode = detail.subtitle_mode ?? previous?.subtitle_mode ?? 'profile_bio';
  const shouldRecomputeSubtitle = detail.subtitle_mode !== undefined || detail.profile_bio !== undefined;
  const presenceSubtitle = shouldRecomputeSubtitle
    ? resolvePresenceSubtitleForMode(subtitleMode, {
        profileBio: detail.profile_bio ?? context.profileBio,
        activityText: context.activityText,
      })
    : (previous?.presence_subtitle ?? resolvePresenceSubtitleForMode(subtitleMode, context));

  return {
    availability,
    subtitle_mode: subtitleMode,
    presence_subtitle: presenceSubtitle,
    is_reachable: presenceReachableFromAvailability(availability),
  };
}

export function patchOnlineUsersSelfPresence(
  users: PresenceOnlineUser[],
  userUuid: string,
  patch: {
    availability?: PresenceAvailability;
    isReachable?: boolean;
    presenceSubtitle?: string | null;
    avatar?: string | null;
  },
): PresenceOnlineUser[] {
  let changed = false;
  const next = users.map(user => {
    if (user.user_uuid !== userUuid) {
      return user;
    }
    changed = true;
    return {
      ...user,
      ...(patch.availability !== undefined ? { availability: patch.availability } : {}),
      ...(patch.isReachable !== undefined ? { is_online: patch.isReachable } : {}),
      ...(patch.presenceSubtitle !== undefined
        ? { status_text: patch.presenceSubtitle, presence_subtitle: patch.presenceSubtitle }
        : {}),
      ...(patch.avatar !== undefined ? { avatar: patch.avatar } : {}),
    };
  });

  return changed ? next : users;
}

export function patchFriendsSelfPresence(
  friends: PresenceFriend[],
  userUuid: string,
  patch: {
    availability?: PresenceAvailability;
    isReachable?: boolean;
    presenceSubtitle?: string | null;
    avatar?: string | null;
  },
): PresenceFriend[] {
  let changed = false;
  const next = friends.map(friend => {
    if (friend.user_uuid !== userUuid) {
      return friend;
    }
    changed = true;
    return {
      ...friend,
      ...(patch.availability !== undefined ? { availability: patch.availability } : {}),
      ...(patch.isReachable !== undefined ? { is_online: patch.isReachable } : {}),
      ...(patch.presenceSubtitle !== undefined
        ? { status_text: patch.presenceSubtitle, presence_subtitle: patch.presenceSubtitle }
        : {}),
      ...(patch.avatar !== undefined ? { avatar: patch.avatar } : {}),
    };
  });

  return changed ? next : friends;
}

export function applyPendingSelfPresenceToOnlineUsers(
  users: PresenceOnlineUser[],
  viewerUuid: string | null,
  own: OwnPresenceState | null,
  pending: LocalPendingPresenceSettings | null,
): PresenceOnlineUser[] {
  if (!viewerUuid || !own) {
    return users;
  }

  return patchOnlineUsersSelfPresence(users, viewerUuid, {
    availability: pending?.availability ?? own.availability,
    isReachable: own.is_reachable,
    presenceSubtitle: pending?.presence_subtitle ?? own.presence_subtitle ?? null,
  });
}

export function applyPendingSelfPresenceToFriends(
  friends: PresenceFriend[],
  viewerUuid: string | null,
  own: OwnPresenceState | null,
  pending: LocalPendingPresenceSettings | null,
): PresenceFriend[] {
  if (!viewerUuid || !own) {
    return friends;
  }

  return patchFriendsSelfPresence(friends, viewerUuid, {
    availability: pending?.availability ?? own.availability,
    isReachable: own.is_reachable,
    presenceSubtitle: pending?.presence_subtitle ?? own.presence_subtitle ?? null,
  });
}

/** 본인 행 — 프로필 카드(ownPresence)와 목록 점 색을 맞춘다 */
export function resolvePresenceListUserStatus(
  user: {
    user_uuid?: string | null;
    availability?: PresenceAvailability;
    is_online: boolean;
  },
  ownPresence: OwnPresenceState | null,
  viewerUuid: string | null,
): { availability?: PresenceAvailability; isReachable: boolean } {
  if (viewerUuid && user.user_uuid === viewerUuid && ownPresence) {
    return {
      availability: ownPresence.availability,
      isReachable: ownPresence.is_reachable,
    };
  }

  return {
    availability: user.availability,
    isReachable: user.is_online,
  };
}

/**
 * 접속자 목록 표시명 — guest 는 UI 로케일 fallback (서버는 빈 문자열).
 * 레거시 DB에 Guest/방문자가 남아 있어도 동일 키로 덮어 표시한다.
 */
export function resolvePresenceConnectDisplayName(
  user: Pick<PresenceOnlineUser, 'user_uuid' | 'display_name' | 'is_authenticated'>,
  t: MoabomTranslateFn,
): string {
  const isGuest = !user.user_uuid || user.is_authenticated === false;
  if (isGuest) {
    return t('moa_shell.right.presence_guest_fallback');
  }
  const trimmed = user.display_name?.trim() ?? '';
  return trimmed !== '' ? trimmed : t('moa_shell.right.presence_guest_fallback');
}

/** 본인 행 부제 — ownPresence SSOT, 그 외는 API 응답 */
export function resolvePresenceListStatusLine(
  t: MoabomTranslateFn,
  user: {
    user_uuid?: string | null;
    client_ip_masked?: string | null;
    presence_subtitle?: string | null;
    status_text?: string | null;
    is_online: boolean;
  },
  ownPresence: OwnPresenceState | null,
  viewerUuid: string | null,
  isReachable: boolean,
): string {
  if (viewerUuid && user.user_uuid === viewerUuid && ownPresence) {
    const subtitle = ownPresence.presence_subtitle?.trim();
    if (subtitle) {
      return subtitle;
    }
    if (!isReachable) {
      return t('moa_shell.right.presence_offline');
    }
    return t('moa_shell.right.presence_active');
  }

  const maskedIp = user.client_ip_masked?.trim();
  if (!user.user_uuid && maskedIp) {
    return maskedIp;
  }

  const subtitle = resolvePresenceSubtitle(user);
  if (subtitle) {
    return subtitle;
  }
  if (!isReachable) {
    return t('moa_shell.right.presence_offline');
  }
  return t('moa_shell.right.presence_active');
}

/** @deprecated patchOnlineUsersAvailability 대신 patchOnlineUsersSelfPresence 사용 */
export function patchOnlineUsersAvailability(
  users: PresenceOnlineUser[],
  userUuid: string,
  availability: PresenceAvailability,
  isReachable: boolean,
): PresenceOnlineUser[] {
  return patchOnlineUsersSelfPresence(users, userUuid, { availability, isReachable });
}

/** @deprecated patchFriendsAvailability 대신 patchFriendsSelfPresence 사용 */
export function patchFriendsAvailability(
  friends: PresenceFriend[],
  userUuid: string,
  availability: PresenceAvailability,
  isReachable: boolean,
): PresenceFriend[] {
  return patchFriendsSelfPresence(friends, userUuid, { availability, isReachable });
}
