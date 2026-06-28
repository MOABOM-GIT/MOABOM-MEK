import type { ShellNotificationReceivedPayload } from '../runtime/moabomShellNotificationSocket';
import type { ChatMessageCreatedPayload } from '../runtime/moabomChatSocket';

export type PresenceRevisionPayload = {
  tenant_slug: string;
  revision: number;
  reason?: string;
};

export type { ShellNotificationReceivedPayload };

const DEBOUNCE_MS = 300;

type InvalidateHandler = () => void;
type SummaryOnlyHandler = () => void;
type NotificationHandler = (payload: ShellNotificationReceivedPayload) => void;
type ChatInboxHandler = (payload: ChatMessageCreatedPayload) => void;

let lastKnownTenantRevision = 0;
let lastKnownPlatformRevision = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let platformDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const invalidateHandlers = new Set<InvalidateHandler>();
const platformSummaryHandlers = new Set<SummaryOnlyHandler>();
let notificationHandlers = new Set<NotificationHandler>();
const chatInboxHandlers = new Set<ChatInboxHandler>();

export function registerShellPresenceInvalidate(handler: InvalidateHandler): () => void {
  invalidateHandlers.add(handler);
  return () => {
    invalidateHandlers.delete(handler);
  };
}

export function registerShellPlatformSummaryInvalidate(handler: SummaryOnlyHandler): () => void {
  platformSummaryHandlers.add(handler);
  return () => {
    platformSummaryHandlers.delete(handler);
  };
}

export function noteShellPresenceRevision(revision: number | undefined | null): void {
  if (typeof revision !== 'number' || !Number.isFinite(revision)) {
    return;
  }
  if (revision > lastKnownTenantRevision) {
    lastKnownTenantRevision = revision;
  }
}

function schedulePresenceInvalidate(): void {
  if (invalidateHandlers.size === 0) {
    return;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    invalidateHandlers.forEach(handler => handler());
  }, DEBOUNCE_MS);
}

function schedulePlatformSummaryInvalidate(): void {
  if (platformSummaryHandlers.size === 0) {
    return;
  }
  if (platformDebounceTimer) {
    clearTimeout(platformDebounceTimer);
  }
  platformDebounceTimer = setTimeout(() => {
    platformDebounceTimer = null;
    platformSummaryHandlers.forEach(handler => handler());
  }, DEBOUNCE_MS);
}

export function handleShellPresenceRevisionEvent(raw: unknown): void {
  if (!raw || typeof raw !== 'object') {
    return;
  }
  const payload = raw as Partial<PresenceRevisionPayload>;
  if (typeof payload.revision !== 'number' || !Number.isFinite(payload.revision)) {
    return;
  }

  if (payload.tenant_slug === 'platform') {
    if (payload.revision <= lastKnownPlatformRevision) {
      return;
    }
    lastKnownPlatformRevision = payload.revision;
    schedulePlatformSummaryInvalidate();
    return;
  }

  if (payload.revision <= lastKnownTenantRevision) {
    return;
  }
  lastKnownTenantRevision = payload.revision;
  schedulePresenceInvalidate();
}

export function registerShellNotificationHandler(handler: NotificationHandler | null): () => void {
  if (!handler) {
    return () => undefined;
  }
  notificationHandlers.add(handler);
  return () => {
    notificationHandlers.delete(handler);
  };
}

export function registerShellChatInboxHandler(handler: ChatInboxHandler | null): () => void {
  if (!handler) {
    return () => undefined;
  }
  chatInboxHandlers.add(handler);
  return () => {
    chatInboxHandlers.delete(handler);
  };
}

export function dispatchShellNotificationReceived(payload: ShellNotificationReceivedPayload): void {
  notificationHandlers.forEach(handler => handler(payload));
}

export function dispatchShellChatInboxUpdated(payload: ChatMessageCreatedPayload): void {
  chatInboxHandlers.forEach(handler => handler(payload));
}

/** @deprecated moabomShellRealtimeCoordinator 가 구독을 소유합니다. */
export function subscribeShellNotification(_userUuid: string): boolean {
  return true;
}

/** @deprecated moabomShellRealtimeCoordinator 가 구독을 소유합니다. */
export function unsubscribeShellNotification(): void {
  // no-op — 셸 코디네이터가 구독 수명을 관리
}

export function resetShellRealtimeStoreForTest(): void {
  lastKnownTenantRevision = 0;
  lastKnownPlatformRevision = 0;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (platformDebounceTimer) {
    clearTimeout(platformDebounceTimer);
    platformDebounceTimer = null;
  }
  invalidateHandlers.clear();
  platformSummaryHandlers.clear();
  notificationHandlers.clear();
  chatInboxHandlers.clear();
}
