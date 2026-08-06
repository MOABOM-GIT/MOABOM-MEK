/** 셸 알림 unread 배지 동기화 이벤트 SSOT */

export const MOABOM_SHELL_UNREAD_SYNCED_EVENT = 'moabom-shell-unread-synced';

type UnreadSyncedDetail = { count: number };

let estimatedUnreadCount = 0;
const provisionalNotificationKeys = new Set<string>();

export function getEstimatedShellUnreadCount(): number {
  return estimatedUnreadCount;
}

export function syncEstimatedShellUnreadCount(count: number): void {
  if (typeof count === 'number' && Number.isFinite(count) && count >= 0) {
    estimatedUnreadCount = count;
  }
}

export function dispatchShellUnreadSynced(count: number): void {
  syncEstimatedShellUnreadCount(count);
  window.dispatchEvent(new CustomEvent<UnreadSyncedDetail>(MOABOM_SHELL_UNREAD_SYNCED_EVENT, {
    detail: { count },
  }));
}

/** WS notification.received — REST 폴링 없이 배지 +1 */
export function bumpShellUnreadBadgeFromRealtime(): void {
  dispatchShellUnreadSynced(estimatedUnreadCount + 1);
}

export function bumpShellUnreadBadgeProvisional(key: string): void {
  const normalized = key.trim();
  if (!normalized || provisionalNotificationKeys.has(normalized)) {
    return;
  }
  provisionalNotificationKeys.add(normalized);
  bumpShellUnreadBadgeFromRealtime();
}

export function consumeShellUnreadBadgeProvisional(key: string): boolean {
  const normalized = key.trim();
  if (!normalized || !provisionalNotificationKeys.has(normalized)) {
    return false;
  }
  provisionalNotificationKeys.delete(normalized);
  return true;
}

/** 인증 계정 경계 전환 — 이전 사용자의 배지·임시 notification 키를 즉시 폐기한다. */
export function clearShellUnreadBadge(): void {
  provisionalNotificationKeys.clear();
  if (typeof window !== 'undefined') {
    dispatchShellUnreadSynced(0);
    return;
  }
  estimatedUnreadCount = 0;
}

export function resetShellUnreadBadgeForTest(): void {
  clearShellUnreadBadge();
}
