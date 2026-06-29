/** 내가 나간(목록 삭제) 대화 — WS 이벤트로 목록이 복원되지 않도록 SSOT */
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

export function resetConversationLeftForTest(): void {
  leftConversationUuids.clear();
}
