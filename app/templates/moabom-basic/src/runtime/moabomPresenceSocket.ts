type PresenceMember = {
  uuid?: string;
  name?: string;
  avatar?: string | null;
};

type EchoPresenceChannel = {
  here: (callback: (members: PresenceMember[]) => void) => EchoPresenceChannel;
  joining: (callback: (member: PresenceMember) => void) => EchoPresenceChannel;
  leaving: (callback: (member: PresenceMember) => void) => EchoPresenceChannel;
  listen: (event: string, callback: (data: unknown) => void) => EchoPresenceChannel;
};

type EchoLike = {
  join: (channel: string) => EchoPresenceChannel;
  leave: (channel: string) => void;
};

function getEcho(): EchoLike | null {
  const manager = (window as {
    G7Core?: { websocket?: { manager?: { getEcho?: () => EchoLike | null } } };
  }).G7Core?.websocket?.manager;
  return manager?.getEcho?.() ?? null;
}

export type PresenceSocketSubscription = {
  channel: string;
  leave: () => void;
};

export function subscribeTenantPresenceChannel(
  channel: string,
  handlers: {
    onHere?: (members: PresenceMember[]) => void;
    onJoining?: (member: PresenceMember) => void;
    onLeaving?: (member: PresenceMember) => void;
  },
): PresenceSocketSubscription | null {
  const echo = getEcho();
  if (!echo) {
    return null;
  }

  const presence = echo.join(channel);
  if (handlers.onHere) {
    presence.here(handlers.onHere);
  }
  if (handlers.onJoining) {
    presence.joining(handlers.onJoining);
  }
  if (handlers.onLeaving) {
    presence.leaving(handlers.onLeaving);
  }

  return {
    channel,
    leave: () => echo.leave(channel),
  };
}

export function leaveTenantPresenceChannel(channel: string): void {
  getEcho()?.leave(channel);
}
