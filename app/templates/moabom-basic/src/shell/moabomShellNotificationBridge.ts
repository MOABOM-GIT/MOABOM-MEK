import type { ShellNotificationItem } from '../api/moabomShellNotificationsApi';
import { pushNotificationToast } from '../runtime/moaShellToasts';
import type { ShellNotificationReceivedPayload } from '../runtime/moabomShellNotificationSocket';
import {
  extractProfileUserUuidFromUrl,
  pushFriendAcceptConfirmToast,
  resolveFriendRequesterName,
} from './moabomFriendNotificationActions';
import { moabomT } from '../i18n/moabomT';
import { navigateMoabomNotificationUrl } from '../utils/moabomNotificationNavigateUrl';
import { extractChatSenderUuidFromUrl } from '../utils/moabomChatNotificationNavigate';
import { isMoabomShellActiveChatWithUser } from '../runtime/moabomShellActiveChat';
import { registerShellNotificationHandler } from './ShellRealtimeStore';

type NotificationCacheListener = (items: ShellNotificationItem[]) => void;

let cachedItems: ShellNotificationItem[] = [];
const cacheListeners = new Set<NotificationCacheListener>();
let bridgeInstalled = false;

function payloadToItem(payload: ShellNotificationReceivedPayload): ShellNotificationItem | null {
  const id = payload.id?.trim();
  if (!id) {
    return null;
  }

  return {
    id,
    type: payload.type?.trim() ?? '',
    type_label: '',
    subject: payload.subject?.trim() ?? null,
    body: payload.body?.trim() ?? null,
    url: payload.url?.trim() ?? null,
    data: payload.data ?? null,
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

function notifyCacheListeners(): void {
  cacheListeners.forEach(listener => listener(cachedItems));
}

function prependCachedItem(item: ShellNotificationItem): void {
  if (cachedItems.some(row => row.id === item.id)) {
    return;
  }
  cachedItems = [item, ...cachedItems];
  notifyCacheListeners();
}

function handleRealtimeNotification(payload: ShellNotificationReceivedPayload): void {
  const incoming = payloadToItem(payload);
  if (incoming) {
    prependCachedItem(incoming);
  }

  const notificationType = payload.type?.trim() ?? '';
  const senderUuid = extractChatSenderUuidFromUrl(payload.url);
  if (notificationType === 'chat_message' && senderUuid && isMoabomShellActiveChatWithUser(senderUuid)) {
    return;
  }

  if (notificationType === 'friend_request') {
    const requesterUuid = extractProfileUserUuidFromUrl(payload.url)
      ?? (typeof payload.data?.requester_uuid === 'string' ? payload.data.requester_uuid : null);
    const requesterName = resolveFriendRequesterName(payload.subject, payload.body, payload.data ?? null)
      ?? moabomT('moa_chat.unknown_sender');
    if (requesterUuid) {
      pushFriendAcceptConfirmToast({
        requesterUuid,
        requesterName,
        t: moabomT,
      });
      return;
    }
  }

  const message = payload.subject?.trim() || moabomT('moa_shell.right.new_notification_received');
  const navigateUrl = payload.url?.trim();
  if (navigateUrl) {
    pushNotificationToast(message, 2800, {
      label: moabomT('moa_shell.right.notification_open'),
      onClick: () => navigateMoabomNotificationUrl(navigateUrl, payload.type, payload.data ?? null),
    });
  } else if (message) {
    pushNotificationToast(message);
  }
}

export function getShellNotificationCache(): ShellNotificationItem[] {
  return cachedItems;
}

export function setShellNotificationCache(items: ShellNotificationItem[]): void {
  cachedItems = items;
  notifyCacheListeners();
}

export function registerShellNotificationCacheListener(listener: NotificationCacheListener): () => void {
  listener(cachedItems);
  cacheListeners.add(listener);
  return () => cacheListeners.delete(listener);
}

/** PresenceProvider 부트 시 1회 — RightPanel 마운트와 무관하게 토스트·캐시 갱신 */
export function installShellNotificationBridge(): void {
  if (bridgeInstalled) {
    return;
  }
  bridgeInstalled = true;
  registerShellNotificationHandler(handleRealtimeNotification);
}

export function resetShellNotificationBridgeForTest(): void {
  cachedItems = [];
  cacheListeners.clear();
  bridgeInstalled = false;
}
