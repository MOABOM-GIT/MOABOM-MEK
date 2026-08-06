/** 세션 내 WS·REST 레이스 동안 나간 방 재유입 방지. 목록 SSOT는 서버 멤버십 soft-delete. */
const leftConversationUuids = new Set<string>();

export function markConversationLeft(conversationUuid: string): void {
  const normalized = conversationUuid.trim();
  if (normalized) {
    leftConversationUuids.add(normalized);
  }
}

export function clearConversationLeft(conversationUuid: string): void {
  leftConversationUuids.delete(conversationUuid.trim());
}

export function isConversationLeft(conversationUuid: string | null | undefined): boolean {
  if (!conversationUuid) {
    return false;
  }

  return leftConversationUuids.has(conversationUuid.trim());
}

export function clearConversationLeftState(): void {
  leftConversationUuids.clear();
}

export function resetConversationLeftForTest(): void {
  clearConversationLeftState();
}
