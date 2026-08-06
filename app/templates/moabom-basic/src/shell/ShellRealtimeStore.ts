import type { ShellNotificationReceivedPayload } from '../runtime/moabomShellNotificationSocket';
import type { ChatMessageCreatedPayload } from '../runtime/moabomChatSocket';
import {
  mergePresenceRefetchTargets,
  resolvePresenceRefetchTargets,
  type PresenceRefetchTargets,
} from './presenceRevisionInvalidation';

export type PresenceRevisionPayload = {
  tenant_slug: string;
  revision: number;
  reason?: string;
  event_id?: string;
  occurred_at?: string;
};

export type { ShellNotificationReceivedPayload, PresenceRefetchTargets };

const DEBOUNCE_MS = 300;
const MAX_SEEN_EVENT_KEYS = 512;

type InvalidateHandler = (targets: PresenceRefetchTargets) => void;
type SummaryOnlyHandler = () => void;
type NotificationHandler = (payload: ShellNotificationReceivedPayload) => void;
type ChatInboxHandler = (payload: ChatMessageCreatedPayload) => void;

let lastKnownTenantRevision = 0;
let lastKnownPlatformRevision = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let platformDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingRefetchTargets: PresenceRefetchTargets | null = null;
const invalidateHandlers = new Set<InvalidateHandler>();
const platformSummaryHandlers = new Set<SummaryOnlyHandler>();
let notificationHandlers = new Set<NotificationHandler>();
const chatInboxHandlers = new Set<ChatInboxHandler>();
const seenEventKeys = new Set<string>();

function acceptEvent(key: string | null): boolean {
  if (!key) {
    return true;
  }
  if (seenEventKeys.has(key)) {
    return false;
  }
  seenEventKeys.add(key);
  if (seenEventKeys.size > MAX_SEEN_EVENT_KEYS) {
    const oldest = seenEventKeys.values().next().value;
    if (typeof oldest === 'string') {
      seenEventKeys.delete(oldest);
    }
  }
  return true;
}

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

function flushPresenceInvalidate(): void {
  const targets = pendingRefetchTargets ?? resolvePresenceRefetchTargets();
  pendingRefetchTargets = null;
  invalidateHandlers.forEach(handler => handler(targets));
}

function schedulePresenceInvalidate(reason?: string): void {
  if (invalidateHandlers.size === 0) {
    return;
  }
  pendingRefetchTargets = mergePresenceRefetchTargets(
    pendingRefetchTargets,
    resolvePresenceRefetchTargets(reason),
  );
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    flushPresenceInvalidate();
  }, DEBOUNCE_MS);
}

/** WS 재연결·탭 복귀 catch-up — revision debounce 와 동일 큐. */
export function scheduleShellPresenceCatchUp(): void {
  schedulePresenceInvalidate('ws_reconnect');
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
  if (!acceptEvent(payload.event_id ? `presence:${payload.event_id}` : null)) {
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
  schedulePresenceInvalidate(payload.reason);
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
  const eventId = payload.event_id?.trim() || payload.id?.trim() || null;
  const eventKind = payload.authoritative ? 'state' : 'item';
  if (!acceptEvent(eventId ? `notification:${eventKind}:${eventId}` : null)) {
    return;
  }
  notificationHandlers.forEach(handler => handler(payload));
}

export function dispatchShellChatInboxUpdated(payload: ChatMessageCreatedPayload): void {
  const eventId = payload.event_id?.trim();
  if (!acceptEvent(eventId ? `chat:${eventId}` : null)) {
    return;
  }
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
  pendingRefetchTargets = null;
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
  seenEventKeys.clear();
}
