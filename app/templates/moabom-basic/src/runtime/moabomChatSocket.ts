import type { ChatConversation, ChatMessage } from '../api/moabomChatApi';

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

  return {
    unsubscribe: () => keys.forEach(key => ws.unsubscribe?.(key)),
  };
}
