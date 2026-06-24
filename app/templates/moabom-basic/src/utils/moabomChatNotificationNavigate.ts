import { notifyBoardShellUrlChanged } from '../shell/moaShellBoardBridge';
import { setMoabomShellPendingChatNavigation } from '../runtime/moabomShellPendingChatNavigation';
import type { ShellNotificationItem } from '../api/moabomShellNotificationsApi';
import { pushShellPath } from './moabomShellRoutes';

const CHAT_USER_PATH = /^\/users\/([0-9a-f-]{36})\/chat$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractNotificationPath(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (typeof window !== 'undefined' && parsed.origin !== window.location.origin) {
        return trimmed;
      }
      const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      return path || '/';
    } catch {
      return trimmed;
    }
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

export function extractChatSenderUuidFromUrl(url?: string | null): string | null {
  const path = extractNotificationPath(url)?.split(/[?#]/)[0] ?? '';
  const match = path.match(CHAT_USER_PATH);
  return match?.[1] ?? null;
}

export function extractChatConversationUuidFromUrl(url?: string | null): string | null {
  const path = extractNotificationPath(url);
  if (!path) {
    return null;
  }
  const queryIndex = path.indexOf('?');
  if (queryIndex < 0) {
    return null;
  }
  const conversation = new URLSearchParams(path.slice(queryIndex + 1)).get('conversation');
  return isUuid(conversation) ? conversation : null;
}

export function extractChatNotificationTarget(
  item: Pick<ShellNotificationItem, 'type' | 'url' | 'data'>,
): MoabomShellPendingChatNavigation | null {
  if ((item.type ?? '').trim() !== 'chat_message') {
    return null;
  }

  const payload = readRecord(item.data);
  const inner = readRecord(payload?.data) ?? payload;

  let senderUuid = extractChatSenderUuidFromUrl(item.url);
  let conversationUuid = extractChatConversationUuidFromUrl(item.url);

  if (!senderUuid && typeof inner?.sender_uuid === 'string') {
    senderUuid = inner.sender_uuid;
  }
  if (!conversationUuid && typeof inner?.conversation_uuid === 'string') {
    conversationUuid = inner.conversation_uuid;
  }
  if (!senderUuid && typeof payload?.sender_uuid === 'string') {
    senderUuid = payload.sender_uuid;
  }
  if (!conversationUuid && typeof payload?.conversation_uuid === 'string') {
    conversationUuid = payload.conversation_uuid;
  }
  if (typeof payload?.click_url === 'string') {
    senderUuid = senderUuid ?? extractChatSenderUuidFromUrl(payload.click_url);
    conversationUuid = conversationUuid ?? extractChatConversationUuidFromUrl(payload.click_url);
  }

  if (!isUuid(senderUuid)) {
    return null;
  }

  return {
    peerUserUuid: senderUuid,
    conversationUuid: isUuid(conversationUuid) ? conversationUuid : null,
  };
}

export function navigateMoabomChatConversation(
  senderUuid: string,
  conversationUuid?: string | null,
): void {
  const normalizedSender = senderUuid.trim();
  if (!isUuid(normalizedSender)) {
    return;
  }

  const normalizedConversation = isUuid(conversationUuid) ? conversationUuid.trim() : null;
  setMoabomShellPendingChatNavigation({
    peerUserUuid: normalizedSender,
    conversationUuid: normalizedConversation,
  });

  const base = `/users/${encodeURIComponent(normalizedSender)}/chat`;
  const path = normalizedConversation
    ? `${base}?conversation=${encodeURIComponent(normalizedConversation)}`
    : base;
  pushShellPath(path);
  notifyBoardShellUrlChanged();
}

export function navigateMoabomChatNotification(
  item: Pick<ShellNotificationItem, 'type' | 'url' | 'data'>,
): boolean {
  const target = extractChatNotificationTarget(item);
  if (!target) {
    return false;
  }
  navigateMoabomChatConversation(target.peerUserUuid, target.conversationUuid);
  return true;
}
