import type { BoardShellMode } from '../utils/moabomShellRoutes';
import type { MyPageTab } from '../components/composite/mypage/myPageTypes';

export type ShellPresenceForeground = {
  appId: string;
  title?: string;
  boardSlug?: string;
  boardPostId?: string;
  boardMode?: BoardShellMode;
  userProfileUuid?: string;
  myPageInitialTab?: MyPageTab;
};

export type ShellPresenceSnapshot = {
  foreground?: ShellPresenceForeground | null;
};

declare global {
  interface Window {
    __moabomShellPresence?: ShellPresenceSnapshot;
  }
}

export function publishShellPresenceForeground(foreground: ShellPresenceForeground | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.__moabomShellPresence = { foreground };
  window.dispatchEvent(new CustomEvent('moabom-shell-presence-context-changed'));
}

export function readShellPresenceForeground(): ShellPresenceForeground | null {
  return window.__moabomShellPresence?.foreground ?? null;
}
