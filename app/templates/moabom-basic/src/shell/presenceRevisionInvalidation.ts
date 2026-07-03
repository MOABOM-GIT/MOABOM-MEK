export type PresenceRefetchTargets = {
  summary: boolean;
  online: boolean;
  friends: boolean;
};

const FRIENDSHIP_REASONS = new Set([
  'friendship_requested',
  'friendship_accepted',
  'friendship_removed',
]);

/**
 * presence.revision reason → REST refetch 범위.
 * 낙관적 patch 가능한 preference 는 목록만, heartbeat 는 friends 제외.
 */
export function resolvePresenceRefetchTargets(reason?: string): PresenceRefetchTargets {
  if (!reason) {
    return { summary: true, online: true, friends: false };
  }

  if (FRIENDSHIP_REASONS.has(reason)) {
    return { summary: false, online: true, friends: true };
  }

  switch (reason) {
    case 'preference':
      return { summary: false, online: true, friends: true };
    case 'mirror':
      return { summary: true, online: false, friends: false };
    case 'ws_reconnect':
    case 'catchup':
      return { summary: true, online: true, friends: false };
    case 'login':
    case 'logout':
      return { summary: true, online: true, friends: true };
    case 'heartbeat':
    case 'prune':
      return { summary: true, online: true, friends: false };
    default:
      return { summary: true, online: true, friends: false };
  }
}

export function mergePresenceRefetchTargets(
  current: PresenceRefetchTargets | null,
  next: PresenceRefetchTargets,
): PresenceRefetchTargets {
  if (!current) {
    return { ...next };
  }
  return {
    summary: current.summary || next.summary,
    online: current.online || next.online,
    friends: current.friends || next.friends,
  };
}
