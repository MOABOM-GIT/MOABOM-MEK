import type { ShellNotificationItem } from '../api/moabomShellNotificationsApi';
import { pushNotificationToast } from '../runtime/moaShellToasts';
import type { ShellNotificationReceivedPayload } from '../runtime/moabomShellNotificationSocket';
import {
  extractProfileUserUuidFromUrl,
  pushFriendAcceptConfirmToast,
  resolveFriendRequesterName,
} from './moabomFriendNotificationActions';
import { notifyMoabomPresenceFriendsChanged } from './moabomPresenceFriendsSync';
import { moabomT } from '../i18n/moabomT';
import { navigateMoabomNotificationUrl } from '../utils/moabomNotificationNavigateUrl';
import { extractChatConversationUuidFromUrl, extractChatSenderUuidFromUrl } from '../utils/moabomChatNotificationNavigate';
import { isMoabomShellActiveChatWithUser } from '../runtime/moabomShellActiveChat';
import { registerShellNotificationHandler } from './ShellRealtimeStore';
import { isShellChatConversationMuted } from './moabomShellChatInboxCache';
import {
  consumeShellUnreadBadgeProvisional,
  dispatchShellUnreadSynced,
} from './moabomShellUnreadBadge';

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

function prependCachedItem(item: ShellNotificationItem): boolean {
  if (cachedItems.some(row => row.id === item.id)) {
    return false;
  }
  cachedItems = [item, ...cachedItems];
  notifyCacheListeners();
  return true;
}

function shouldSuppressChatNotificationToast(payload: ShellNotificationReceivedPayload): boolean {
  if (payload.type?.trim() !== 'chat_message') {
    return false;
  }

  const data = payload.data;
  const conversationUuid = (
    typeof data?.conversation_uuid === 'string' ? data.conversation_uuid.trim() : ''
  ) || extractChatConversationUuidFromUrl(payload.url) || '';

  if (!conversationUuid) {
    return false;
  }

  return isShellChatConversationMuted(conversationUuid);
}

function handleRealtimeNotification(payload: ShellNotificationReceivedPayload): void {
  const changedIds = new Set([
    ...(payload.changed_id ? [payload.changed_id] : []),
    ...(payload.changed_ids ?? []),
  ]);
  if (payload.all_deleted) {
    cachedItems = [];
    notifyCacheListeners();
  } else if (payload.deleted_id) {
    cachedItems = cachedItems.filter(item => item.id !== payload.deleted_id);
    notifyCacheListeners();
  } else if (payload.all_read || changedIds.size > 0) {
    const readAt = new Date().toISOString();
    cachedItems = cachedItems.map(item => (
      payload.all_read || changedIds.has(item.id)
        ? { ...item, read_at: item.read_at ?? readAt }
        : item
    ));
    notifyCacheListeners();
  }

  const incoming = payloadToItem(payload);
  let inserted = false;
  if (incoming) {
    inserted = prependCachedItem(incoming);
  }

  if (payload.authoritative && typeof payload.unread_count === 'number') {
    dispatchShellUnreadSynced(payload.unread_count);
  }

  // 앞선 notification.received가 이미 항목·토스트를 처리했다면 state는 count 정합만 담당합니다.
  if (payload.authoritative && incoming && !inserted) {
    return;
  }

  const notificationType = payload.type?.trim() ?? '';
  const messageUuid = typeof payload.data?.message_uuid === 'string'
    ? payload.data.message_uuid
    : '';
  if (notificationType === 'chat_message' && messageUuid !== '') {
    consumeShellUnreadBadgeProvisional(messageUuid);
  }
  const senderUuid = extractChatSenderUuidFromUrl(payload.url);
  const suppressActiveChat = notificationType === 'chat_message'
    && Boolean(senderUuid)
    && isMoabomShellActiveChatWithUser(senderUuid!);

  if (shouldSuppressChatNotificationToast(payload)) {
    return;
  }

  if (suppressActiveChat) {
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

  if (notificationType === 'friend_accepted') {
    notifyMoabomPresenceFriendsChanged();
  }

  // 백그라운드 탭은 Browser Notification/FCM 경로가 담당합니다.
  // 숨겨진 in-app toast를 쌓아 복귀 시 중복 노출하지 않습니다.
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    return;
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
