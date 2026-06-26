import type { ShellNotificationReceivedPayload } from './moabomShellNotificationSocket';
import { registerShellNotificationHandler } from '../shell/ShellRealtimeStore';

let installed = false;

function canUseBrowserNotification(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function ensureMoabomChatNotificationPermission(): Promise<NotificationPermission | null> {
  if (!canUseBrowserNotification()) {
    return null;
  }
  if (Notification.permission === 'default') {
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }
  return Notification.permission;
}

function showBackgroundNotification(payload: ShellNotificationReceivedPayload): void {
  if (!canUseBrowserNotification() || Notification.permission !== 'granted') {
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
 * 탭이 백그라운드일 때 OS 알림 (Phase 4 — FCM 전 웹 Notification API).
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
