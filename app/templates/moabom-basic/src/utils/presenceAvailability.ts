import type { PresenceAvailability } from '../api/moabomPresenceApi';

export function presenceStatusDotClass(
  availability: PresenceAvailability | undefined,
  isReachable: boolean,
): string {
  if (!isReachable || availability === 'offline') {
    return 'moa-status-offline';
  }

  switch (availability) {
    case 'busy':
      return 'moa-status-busy';
    case 'away':
      return 'moa-status-away';
    case 'online':
    default:
      return 'moa-status-online';
  }
}

/** 자리 비움 — 접속자 목록 아바타(사진·이니셜) 회색 처리 */
export function presenceAvatarAwayClass(
  availability: PresenceAvailability | undefined,
  isReachable: boolean,
): string {
  return isReachable && availability === 'away' ? 'moa-presence-avatar-away' : '';
}

export function resolvePresenceSubtitle(
  user: { presence_subtitle?: string | null; status_text?: string | null },
): string | null {
  const subtitle = user.presence_subtitle ?? user.status_text;
  if (typeof subtitle !== 'string') {
    return null;
  }
  const trimmed = subtitle.trim();
  return trimmed !== '' ? trimmed : null;
}
