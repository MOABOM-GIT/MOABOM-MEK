import type { ChatConversation, ChatMessage } from '../api/moabomChatApi';
import { shellNotificationChannelName } from './moabomShellNotificationSocket';

type G7WebSocketApi = {
  subscribe?: (
    channel: string,
    event: string,
    callback: (data: unknown) => void,
    options?: { channelType?: 'public' | 'private' | 'presence' },
  ) => string;
  unsubscribe?: (subscriptionKey: string) => void;
};

export type ChatMessageCreatedPayload = {
  message?: ChatMessage;
  conversation?: ChatConversation;
  conversation_uuid?: string;
  last_message_at?: string | null;
};

export type ChatReadPayload = {
  conversation_uuid?: string;
  user_uuid?: string;
  last_read_message_id?: number | null;
  last_read_at?: string | null;
};

export type ChatTypingPayload = {
  conversation_uuid?: string;
  user_uuid?: string;
};

export type ChatMessageDeletedPayload = {
  message_uuid?: string;
  conversation_uuid?: string;
};

export type ChatMemberLeftPayload = {
  conversation_uuid?: string;
  user_uuid?: string;
  conversation?: ChatConversation;
  reason?: string;
};

export type ChatSocketSubscription = {
  unsubscribe: () => void;
};

function getWebSocketApi(): G7WebSocketApi | null {
  return (window as { G7Core?: { websocket?: G7WebSocketApi } }).G7Core?.websocket ?? null;
}

export function subscribeChatConversation(
  channel: string,
  handlers: {
    onMessageCreated?: (payload: ChatMessageCreatedPayload) => void;
    onRead?: (payload: ChatReadPayload) => void;
    onTyping?: (payload: ChatTypingPayload) => void;
    onMessageDeleted?: (payload: ChatMessageDeletedPayload) => void;
    onMemberLeft?: (payload: ChatMemberLeftPayload) => void;
  },
): ChatSocketSubscription | null {
  const ws = getWebSocketApi();
  if (!ws?.subscribe || !channel) {
    return null;
  }

  const keys: string[] = [];
  if (handlers.onMessageCreated) {
    const key = ws.subscribe(
      channel,
      'message.created',
      raw => handlers.onMessageCreated?.((raw && typeof raw === 'object' ? raw : {}) as ChatMessageCreatedPayload),
      { channelType: 'private' },
    );
    if (key) keys.push(key);
  }
  if (handlers.onRead) {
    const key = ws.subscribe(
      channel,
      'conversation.read',
      raw => handlers.onRead?.((raw && typeof raw === 'object' ? raw : {}) as ChatReadPayload),
      { channelType: 'private' },
    );
    if (key) keys.push(key);
  }
  if (handlers.onTyping) {
    const key = ws.subscribe(
      channel,
      'conversation.typing',
      raw => handlers.onTyping?.((raw && typeof raw === 'object' ? raw : {}) as ChatTypingPayload),
      { channelType: 'private' },
    );
    if (key) keys.push(key);
  }
  if (handlers.onMessageDeleted) {
    const key = ws.subscribe(
      channel,
      'message.deleted',
      raw => handlers.onMessageDeleted?.((raw && typeof raw === 'object' ? raw : {}) as ChatMessageDeletedPayload),
      { channelType: 'private' },
    );
    if (key) keys.push(key);
  }
  if (handlers.onMemberLeft) {
    const key = ws.subscribe(
      channel,
      'conversation.member_left',
      raw => handlers.onMemberLeft?.((raw && typeof raw === 'object' ? raw : {}) as ChatMemberLeftPayload),
      { channelType: 'private' },
    );
    if (key) keys.push(key);
  }

  if (keys.length === 0) {
    return null;
  }

  return {
    unsubscribe: () => keys.forEach(key => ws.unsubscribe?.(key)),
  };
}

export function subscribeChatInbox(
  userUuid: string,
  handlers: {
    onInboxUpdated?: (payload: ChatMessageCreatedPayload) => void;
  },
): ChatSocketSubscription | null {
  const ws = getWebSocketApi();
  if (!ws?.subscribe || !userUuid) {
    return null;
  }

  const keys: string[] = [];
  if (handlers.onInboxUpdated) {
    const key = ws.subscribe(
      shellNotificationChannelName(userUuid),
      'chat.inbox.updated',
      raw => handlers.onInboxUpdated?.((raw && typeof raw === 'object' ? raw : {}) as ChatMessageCreatedPayload),
      { channelType: 'private' },
    );
    if (key) keys.push(key);
  }

  if (keys.length === 0) {
    return null;
  }

  return {
    unsubscribe: () => keys.forEach(key => ws.unsubscribe?.(key)),
  };
}

export function subscribeChatConversations(
  channels: string[],
  handlers: {
    onMessageCreated?: (payload: ChatMessageCreatedPayload) => void;
    onRead?: (payload: ChatReadPayload) => void;
    onTyping?: (payload: ChatTypingPayload) => void;
    onMessageDeleted?: (payload: ChatMessageDeletedPayload) => void;
    onMemberLeft?: (payload: ChatMemberLeftPayload) => void;
  },
): ChatSocketSubscription | null {
  const subscriptions = channels
    .map(channel => subscribeChatConversation(channel, handlers))
    .filter((subscription): subscription is ChatSocketSubscription => subscription !== null);

  if (subscriptions.length === 0) {
    return null;
  }

  return {
    unsubscribe: () => subscriptions.forEach(subscription => subscription.unsubscribe()),
  };
}
