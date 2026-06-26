import type { MyPageTab } from '../components/composite/Moa_MyPageWindowContent';
import type { BoardWindowMode } from './boardWindowLayoutRuntime';
import type { UserProfileWindowView } from './userProfileWindowLayoutRuntime';

/** 셸 오버레이 표면 종류 SSOT — `app/docs/moabom-shell-realtime-architecture.md` */
export type ShellSurfaceKind =
  | 'profile'
  | 'board'
  | 'mypage'
  | 'auth'
  | 'legal'
  | 'error'
  | 'app';

export type ShellSurfaceOpenAction =
  | {
    kind: 'profile';
    userUuid: string;
    view?: UserProfileWindowView;
    displayName?: string;
  }
  | {
    kind: 'board';
    slug: string;
    postId?: string;
    boardMode?: BoardWindowMode;
  }
  | {
    kind: 'mypage';
    tab?: MyPageTab;
  };

export type ShellUrlSyncOptions = {
  skipUrl?: boolean;
  shellPath?: string;
  replace?: boolean;
};

export { SHELL_PROFILE_SURFACE_APP_ID, isMoaShellUserProfileAppId as isShellProfileSurfaceAppId } from './moaShellUserProfileIds';
