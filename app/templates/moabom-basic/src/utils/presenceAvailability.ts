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
