import type { ShellNotificationReceivedPayload } from './moabomShellNotificationSocket';
import { registerShellNotificationHandler } from '../shell/ShellRealtimeStore';
import { MoabomRuntime } from './MoabomRuntime';

let installed = false;

function canUseBrowserNotification(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function showBackgroundNotification(payload: ShellNotificationReceivedPayload): void {
  if (
    !canUseBrowserNotification()
    || Notification.permission !== 'granted'
    || MoabomRuntime.getEffectiveOption('push') === false
  ) {
    return;
  }
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    return;
  }

  const title = payload.subject?.trim() || 'Moabom';
  const body = payload.body?.trim() || undefined;
  try {
    // eslint-disable-next-line no-new
    new Notification(title, { body, tag: payload.id?.trim() || undefined });
  } catch {
    // 브라우저 정책·권한 거부
  }
}

/**
 * Phase 4 — 탭 백그라운드 OS 알림 (앱 살아 있을 때). 종료 푸시는 moabom-fcm.
 */
export function installMoabomShellChatBackgroundNotify(): void {
  if (installed || typeof window === 'undefined') {
    return;
  }
  installed = true;
  registerShellNotificationHandler(payload => {
    showBackgroundNotification(payload);
  });
}

export function resetMoabomShellChatBackgroundNotifyForTest(): void {
  installed = false;
}
