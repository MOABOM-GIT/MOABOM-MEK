type ActiveChatState = {
  conversationUuid: string | null;
  peerUserUuids: string[];
};

let activeChat: ActiveChatState = {
  conversationUuid: null,
  peerUserUuids: [],
};

export function setMoabomShellActiveChat(
  conversationUuid: string | null,
  peerUserUuids: string[] = [],
): void {
  activeChat = {
    conversationUuid,
    peerUserUuids: peerUserUuids.filter(Boolean),
  };
}

export function clearMoabomShellActiveChat(): void {
  activeChat = { conversationUuid: null, peerUserUuids: [] };
}

export function isMoabomShellActiveChatWithUser(userUuid: string | null | undefined): boolean {
  if (!userUuid?.trim()) {
    return false;
  }
  return activeChat.peerUserUuids.includes(userUuid.trim());
}

export function getMoabomShellActiveConversationUuid(): string | null {
  return activeChat.conversationUuid;
}
