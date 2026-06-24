import type { AuthWindowMode } from '../components/composite/Moa_AuthWindowContent';
import type { BoardShellMode } from '../utils/moabomShellRoutes';
import type { UserProfileWindowView } from './userProfileWindowLayoutRuntime';
import { isMoaShellBoardAppId } from './moaShellBoardIds';
import { isMoaShellUserProfileAppId } from './moaShellUserProfileIds';

export const MOA_SHELL_BOARD_URL_EVENT = 'moabom-shell-board-url';

export interface MoaShellBoardOpenOptions {
  /** pathname + search 전체 (쿼리 유지·mergeQuery 반영) */
  shellPath?: string;
  replace?: boolean;
  boardMode?: BoardShellMode;
}

export interface MoaShellUserProfileOpenOptions {
  /** pathname + search 전체 (페이징 mergeQuery 반영) */
  shellPath?: string;
  replace?: boolean;
}

export interface MoaShellBoardBridge {
  isActive: () => boolean;
  openBoard: (slug: string, postId?: string, options?: MoaShellBoardOpenOptions) => void;
  openAuth: (mode: AuthWindowMode) => void;
  openUserProfile?: (userUuid: string, view?: UserProfileWindowView, options?: MoaShellUserProfileOpenOptions) => void;
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

/** 게시판·공개 프로필 윈도우가 열려 있을 때 G7 navigate → 셸 라우팅 브릿지 활성 */
export function isAnyShellNavigateWindowOpen(windows: Array<{ appId: string }>): boolean {
  return windows.some(w => isMoaShellBoardAppId(w.appId) || isMoaShellUserProfileAppId(w.appId));
}
