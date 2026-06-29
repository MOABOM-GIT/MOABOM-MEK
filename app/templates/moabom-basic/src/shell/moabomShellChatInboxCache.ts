import type { ChatConversation, ChatMessage } from '../api/moabomChatApi';
import type { ChatMessageCreatedPayload } from '../runtime/moabomChatSocket';
import {
  isConversationLeft,
  markConversationLeft,
} from '../runtime/moabomShellChatLeftConversations';
import { registerShellChatInboxHandler } from '../shell/ShellRealtimeStore';

type InboxCacheListener = (conversations: ChatConversation[]) => void;

let cachedConversations: ChatConversation[] = [];
const cacheListeners = new Set<InboxCacheListener>();
let inboxBridgeInstalled = false;

function upsertConversation(list: ChatConversation[], conversation: ChatConversation): ChatConversation[] {
  const next = [conversation, ...list.filter(item => item.uuid !== conversation.uuid)];
  return next.sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''));
}

function notifyCacheListeners(): void {
  cacheListeners.forEach(listener => listener(cachedConversations));
}

function applyChatInboxPayload(payload: ChatMessageCreatedPayload & { removed?: boolean; reason?: string }): void {
  const conversationUuid = payload.conversation_uuid
    ?? payload.message?.conversation_uuid
    ?? payload.conversation?.uuid;
  if (!conversationUuid) {
    return;
  }

  if (payload.removed || payload.reason === 'member.left.self') {
    markConversationLeft(conversationUuid);
    cachedConversations = cachedConversations.filter(item => item.uuid !== conversationUuid);
    notifyCacheListeners();
    return;
  }

  if (isConversationLeft(conversationUuid)) {
    return;
  }

  if (payload.conversation) {
    cachedConversations = upsertConversation(cachedConversations, payload.conversation);
    notifyCacheListeners();
    return;
  }

  const incomingMessage = payload.message
    ?? (payload.conversation?.latest_message as ChatMessage | undefined);
  if (!incomingMessage) {
    return;
  }

  cachedConversations = cachedConversations.map(item => (
    item.uuid === conversationUuid
      ? {
        ...item,
        latest_message: incomingMessage,
        last_message_at: payload.last_message_at ?? incomingMessage.created_at ?? item.last_message_at,
        unread_count: item.unread_count + 1,
      }
      : item
  ));
  notifyCacheListeners();
}

export function getShellChatInboxCache(): ChatConversation[] {
  return cachedConversations;
}

export function setShellChatInboxCache(conversations: ChatConversation[]): void {
  cachedConversations = conversations.filter(row => !isConversationLeft(row.uuid));
  notifyCacheListeners();
}

export function registerShellChatInboxCacheListener(listener: InboxCacheListener): () => void {
  listener(cachedConversations);
  cacheListeners.add(listener);
  return () => cacheListeners.delete(listener);
}

export function installShellChatInboxCacheBridge(): void {
  if (inboxBridgeInstalled) {
    return;
  }
  inboxBridgeInstalled = true;
  registerShellChatInboxHandler(applyChatInboxPayload);
}

export function resetShellChatInboxCacheForTest(): void {
  cachedConversations = [];
  cacheListeners.clear();
  inboxBridgeInstalled = false;
}
