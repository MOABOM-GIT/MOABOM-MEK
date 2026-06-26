/** 프로필 대화 탭 자동 시작 — 삭제 후 탭 재진입 시 대화 복원 방지 */
const suppressedPeerUuids = new Set<string>();
const attemptedPeerUuids = new Set<string>();

function normalizePeerUuid(peerUuid: string): string {
  return peerUuid.trim();
}

export function suppressChatAutoStartForPeer(peerUuid: string): void {
  const normalized = normalizePeerUuid(peerUuid);
  if (normalized) {
    suppressedPeerUuids.add(normalized);
  }
}

export function clearChatAutoStartGuard(peerUuid: string): void {
  const normalized = normalizePeerUuid(peerUuid);
  if (!normalized) {
    return;
  }
  suppressedPeerUuids.delete(normalized);
  attemptedPeerUuids.delete(normalized);
}

export function isChatAutoStartSuppressed(peerUuid: string): boolean {
  return suppressedPeerUuids.has(normalizePeerUuid(peerUuid));
}

export function markChatAutoStartAttempted(peerUuid: string): void {
  const normalized = normalizePeerUuid(peerUuid);
  if (normalized) {
    attemptedPeerUuids.add(normalized);
  }
}

export function hasChatAutoStartBeenAttempted(peerUuid: string): boolean {
  return attemptedPeerUuids.has(normalizePeerUuid(peerUuid));
}

export function resetChatAutoStartGuardForTest(): void {
  suppressedPeerUuids.clear();
  attemptedPeerUuids.clear();
}
