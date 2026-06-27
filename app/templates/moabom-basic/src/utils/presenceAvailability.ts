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

/** 자리 비움·오프라인 — 목록 아바타 회색 필터 */
export function presenceAvatarGrayscaleClass(
  availability: PresenceAvailability | undefined,
  isReachable: boolean,
): string {
  if (!isReachable) {
    return 'moa-presence-avatar-away';
  }
  return availability === 'away' ? 'moa-presence-avatar-away' : '';
}

/** @deprecated presenceAvatarGrayscaleClass 사용 */
export function presenceAvatarAwayClass(
  availability: PresenceAvailability | undefined,
  isReachable: boolean,
): string {
  return presenceAvatarGrayscaleClass(availability, isReachable);
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
