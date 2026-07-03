/**
 * 셸 Surface Controller SSOT — 프로필 싱글톤·board·mypage open 액션 타입.
 * 구현: `useMoaShellWindows.openShellSurface` · `shellProfileSurface` · `ShellContextBridge`.
 *
 * @see app/docs/moabom-shell-realtime-architecture.md §2.1–2.2
 */
export type {
  ShellSurfaceKind,
  ShellSurfaceOpenAction,
  ShellUrlSyncOptions,
} from './shellSurfaceTypes';

export {
  SHELL_PROFILE_SURFACE_APP_ID,
  isShellProfileSurfaceAppId,
} from './shellSurfaceTypes';

export {
  findProfileSurfaceWindow,
  isProfileSurfaceAppId,
  onProfileSurfaceSubjectChange,
  purgeProfileSurfaceWindows,
  reconcileProfileSurfaceWindows,
  resolveProfileSurfaceSubjectUuid,
  type ProfileSurfaceOpenParams,
} from './shellProfileSurface';

export {
  getOrCreateShellVisitorId,
  mergeShellContextIntoGlobalState,
  publishShellLayoutContext,
  resolveShellLayoutContext,
  type ShellLayoutContext,
  type ShellLayoutCurrentUser,
} from './ShellContextBridge';

/** 프로필 surface remount key — subject UUID 변경 시 Host 전체 리마운트 */
export function profileSurfaceRemountKey(userUuid: string | undefined, fallbackId: string): string {
  const normalized = userUuid?.trim();
  if (normalized) {
    return `profile:${normalized}`;
  }
  return fallbackId;
}
