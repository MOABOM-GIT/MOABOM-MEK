import type { ChatConversation, ChatMessage } from '../api/moabomChatApi';
import type { ChatMessageCreatedPayload } from '../runtime/moabomChatSocket';
import {
  isConversationLeft,
  markConversationLeft,
  clearConversationLeft,
} from '../runtime/moabomShellChatLeftConversations';
import { registerShellChatInboxHandler } from '../shell/ShellRealtimeStore';

type InboxCacheListener = (conversations: ChatConversation[]) => void;

let cachedConversations: ChatConversation[] = [];
const conversationMuteOverrides = new Map<string, boolean>();
const cacheListeners = new Set<InboxCacheListener>();
let inboxBridgeInstalled = false;

function syncConversationMuteOverrides(conversations: ChatConversation[]): void {
  conversations.forEach(row => {
    if (typeof row.is_muted === 'boolean') {
      conversationMuteOverrides.set(row.uuid, row.is_muted);
    }
  });
}

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

  if (payload.reason === 'member.left') {
    if (payload.conversation) {
      cachedConversations = upsertConversation(cachedConversations, {
        ...payload.conversation,
        is_writable: true,
      });
    } else if (payload.user_uuid) {
      const leftUserUuid = payload.user_uuid.trim();
      cachedConversations = cachedConversations.map(item => (
        item.uuid === conversationUuid
          ? {
            ...item,
            is_writable: true,
            members: item.members.map(member => (
              member.user_uuid === leftUserUuid
                ? { ...member, has_left: true }
                : member
            )),
          }
          : item
      ));
    }
    notifyCacheListeners();
    return;
  }

  if (isConversationLeft(conversationUuid)) {
    if (payload.message || payload.conversation) {
      clearConversationLeft(conversationUuid);
    } else {
      return;
    }
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

export function isShellChatConversationMuted(conversationUuid: string): boolean {
  const trimmed = conversationUuid.trim();
  if (!trimmed) {
    return false;
  }

  if (conversationMuteOverrides.has(trimmed)) {
    return conversationMuteOverrides.get(trimmed) === true;
  }

  const conversation = cachedConversations.find(row => row.uuid === trimmed);
  return conversation?.is_muted === true;
}

export function setShellChatConversationMuteOverride(conversationUuid: string, isMuted: boolean): void {
  const trimmed = conversationUuid.trim();
  if (!trimmed) {
    return;
  }
  conversationMuteOverrides.set(trimmed, isMuted);
}

export function setShellChatInboxCache(conversations: ChatConversation[]): void {
  cachedConversations = conversations.filter(row => !isConversationLeft(row.uuid));
  syncConversationMuteOverrides(cachedConversations);
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
  conversationMuteOverrides.clear();
  cacheListeners.clear();
  inboxBridgeInstalled = false;
}
