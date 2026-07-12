/** 셸 알림 unread 배지 동기화 이벤트 SSOT */

export const MOABOM_SHELL_UNREAD_SYNCED_EVENT = 'moabom-shell-unread-synced';

type UnreadSyncedDetail = { count: number };

let estimatedUnreadCount = 0;

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

export function resetShellUnreadBadgeForTest(): void {
  estimatedUnreadCount = 0;
}
