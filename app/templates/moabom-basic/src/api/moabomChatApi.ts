import { createTransientShellModuleApi } from './moabomShellModuleRequest';
import {
  MoabomShellAuthRequiredError,
  MoabomShellModuleApiError,
  type ShellRequestInit,
} from './moabomShellHttp';

export type ChatMember = {
  user_uuid: string;
  display_name: string;
  nickname?: string | null;
  real_name?: string | null;
  avatar?: string | null;
};

export type ChatPeerRead = {
  user_uuid: string;
  last_read_message_id: number | null;
  last_read_at?: string | null;
};

export type ChatMessage = {
  id: number;
  uuid: string;
  conversation_uuid?: string | null;
  sender?: ChatMember | null;
  body: string;
  type: 'text' | string;
  client_message_id?: string | null;
  created_at?: string | null;
  edited_at?: string | null;
  /** 낙관적 전송 중인 클라이언트 전용 플래그 */
  pending?: boolean;
};

export type ChatConversation = {
  uuid: string;
  type: 'direct' | 'group';
  title?: string | null;
  display_title: string;
  last_message_at?: string | null;
  unread_count: number;
  channel: string;
  members: ChatMember[];
  latest_message?: ChatMessage | null;
  peer_read?: ChatPeerRead[];
  is_muted?: boolean;
  muted_until?: string | null;
};

export type ChatBlock = {
  user_uuid: string;
  display_name: string;
  avatar?: string | null;
  reason?: string | null;
  created_at?: string | null;
};

export type ChatEligibility = {
  can_chat: boolean;
  reason?: string | null;
};

export type ChatUserSearchResult = ChatMember & {
  eligibility: ChatEligibility;
};

export class MoabomChatApiError extends Error {
  reason?: string;
  status: number;

  constructor(message: string, status: number, reason?: string) {
    super(message);
    this.name = 'MoabomChatApiError';
    this.status = status;
    this.reason = reason;
  }
}

/** 프로필·채팅 패널 공통 moabom-chat 모듈 HTTP SSOT (재시도 포함). */
const chatModuleRequest = createTransientShellModuleApi('moabom-chat');

function mapChatError(error: unknown): never {
  if (error instanceof MoabomShellAuthRequiredError) {
    throw new MoabomChatApiError('auth_required', 401, 'auth_required');
  }
  if (error instanceof MoabomShellModuleApiError) {
    throw new MoabomChatApiError(error.message, error.status, error.reason);
  }
  throw error;
}

async function chatRequest<T>(path: string, init: ShellRequestInit = {}): Promise<T> {
  try {
    return await chatModuleRequest<T>(path, init);
  } catch (error) {
    mapChatError(error);
  }
}

export async function fetchChatConversations(search?: string): Promise<ChatConversation[]> {
  const params = new URLSearchParams();
  if (search?.trim()) {
    params.set('search', search.trim());
  }
  const suffix = params.size ? `?${params.toString()}` : '';
  const data = await chatRequest<{ conversations: ChatConversation[] }>(`user/conversations${suffix}`);
  return data.conversations ?? [];
}

export async function startChatConversation(
  memberUuids: string[],
  title?: string | null,
): Promise<ChatConversation> {
  const data = await chatRequest<{ conversation: ChatConversation }>('user/conversations', {
    method: 'POST',
    body: { member_uuids: memberUuids, title },
  });
  return data.conversation;
}

export async function deleteChatConversation(conversationUuid: string): Promise<void> {
  await chatRequest(`user/conversations/${encodeURIComponent(conversationUuid)}`, {
    method: 'DELETE',
  });
}

export async function fetchChatMessages(
  conversationUuid: string,
  beforeId?: number | null,
): Promise<{ messages: ChatMessage[]; has_more: boolean; next_before_id?: number | null; peer_read?: ChatPeerRead[] }> {
  const params = new URLSearchParams();
  if (beforeId) {
    params.set('before_id', String(beforeId));
  }
  const suffix = params.size ? `?${params.toString()}` : '';
  return chatRequest(`user/conversations/${encodeURIComponent(conversationUuid)}/messages${suffix}`);
}

export async function sendChatMessage(
  conversationUuid: string,
  body: string,
  clientMessageId = crypto.randomUUID(),
): Promise<{ message: ChatMessage; conversation: ChatConversation; deduplicated: boolean }> {
  return chatRequest(`user/conversations/${encodeURIComponent(conversationUuid)}/messages`, {
    method: 'POST',
    body: { body, client_message_id: clientMessageId },
  });
}

export async function markChatConversationRead(conversationUuid: string, messageId?: number | null): Promise<void> {
  await chatRequest(`user/conversations/${encodeURIComponent(conversationUuid)}/read`, {
    method: 'POST',
    body: { message_id: messageId },
  });
}

export async function focusChatConversation(conversationUuid: string): Promise<void> {
  await chatRequest(`user/conversations/${encodeURIComponent(conversationUuid)}/focus`, {
    method: 'POST',
  });
}

export async function unfocusChatConversation(conversationUuid: string): Promise<void> {
  await chatRequest(`user/conversations/${encodeURIComponent(conversationUuid)}/focus`, {
    method: 'DELETE',
  });
}

export async function fetchChatBlocks(): Promise<ChatBlock[]> {
  const data = await chatRequest<{ blocks: ChatBlock[] }>('user/blocks');
  return data.blocks ?? [];
}

export async function blockChatUser(userUuid: string): Promise<ChatBlock> {
  const data = await chatRequest<{ block: ChatBlock }>('user/blocks', {
    method: 'POST',
    body: { user_uuid: userUuid },
  });
  return data.block;
}

export async function unblockChatUser(userUuid: string): Promise<void> {
  await chatRequest(`user/blocks/${encodeURIComponent(userUuid)}`, { method: 'DELETE' });
}

export async function fetchChatEligibility(userUuid: string): Promise<ChatEligibility> {
  return chatRequest<ChatEligibility>(`user/users/${encodeURIComponent(userUuid)}/eligibility`);
}

export async function signalChatTyping(conversationUuid: string): Promise<void> {
  await chatRequest(`user/conversations/${encodeURIComponent(conversationUuid)}/typing`, {
    method: 'POST',
  });
}

export async function muteChatConversation(conversationUuid: string, hours?: number | null): Promise<void> {
  await chatRequest(`user/conversations/${encodeURIComponent(conversationUuid)}/mute`, {
    method: 'POST',
    body: hours ? { hours } : {},
  });
}

export async function unmuteChatConversation(conversationUuid: string): Promise<void> {
  await chatRequest(`user/conversations/${encodeURIComponent(conversationUuid)}/mute`, {
    method: 'DELETE',
  });
}

export async function deleteChatMessage(messageUuid: string): Promise<void> {
  await chatRequest(`user/messages/${encodeURIComponent(messageUuid)}`, {
    method: 'DELETE',
  });
}

export async function searchChatUsers(search: string): Promise<ChatUserSearchResult[]> {
  const params = new URLSearchParams();
  params.set('search', search.trim());
  const data = await chatRequest<{ users: ChatUserSearchResult[] }>(`user/users?${params.toString()}`);
  return data.users ?? [];
}
