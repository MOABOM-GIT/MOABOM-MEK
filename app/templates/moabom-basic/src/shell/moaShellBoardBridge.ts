import type { AuthWindowMode } from '../components/composite/Moa_AuthWindowContent';
import type { BoardShellMode } from '../utils/moabomShellRoutes';
import { isMoaShellBoardAppId } from './moaShellBoardIds';

export const MOA_SHELL_BOARD_URL_EVENT = 'moabom-shell-board-url';

export interface MoaShellBoardOpenOptions {
  /** pathname + search 전체 (쿼리 유지·mergeQuery 반영) */
  shellPath?: string;
  replace?: boolean;
  boardMode?: BoardShellMode;
}

export interface MoaShellBoardBridge {
  isActive: () => boolean;
  openBoard: (slug: string, postId?: string, options?: MoaShellBoardOpenOptions) => void;
  openAuth: (mode: AuthWindowMode) => void;
  openUserProfile?: (userUuid: string) => void;
}

export function notifyBoardShellUrlChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MOA_SHELL_BOARD_URL_EVENT));
}

export function getMoaShellBoardBridge(): MoaShellBoardBridge | null {
  return (window as { __moabomShellBoardBridge?: MoaShellBoardBridge | null }).__moabomShellBoardBridge ?? null;
}

export function isAnyBoardShellWindowOpen(windows: Array<{ appId: string }>): boolean {
  return windows.some(w => isMoaShellBoardAppId(w.appId));
}
