import type { WindowState } from '../components/composite/Moa_CenterPanel';
import {
  MOA_SHELL_USER_PROFILE_APP_ID_PREFIX,
  SHELL_PROFILE_SURFACE_APP_ID,
  moaShellUserProfileUuidFromAppId,
} from './moaShellUserProfileIds';
import type { UserProfileWindowView } from './userProfileWindowLayoutRuntime';
import { clearUserProfilePayloadCache, invalidateUserProfileShellBindingCache } from './userProfileWindowPrefetch';

export function isLegacyPerUserProfileAppId(appId: string): boolean {
  return appId.startsWith(MOA_SHELL_USER_PROFILE_APP_ID_PREFIX);
}

export function isProfileSurfaceAppId(appId: string): boolean {
  return appId === SHELL_PROFILE_SURFACE_APP_ID || isLegacyPerUserProfileAppId(appId);
}

export function purgeProfileSurfaceWindows(windows: WindowState[]): WindowState[] {
  return windows.filter(win => !isProfileSurfaceAppId(win.appId));
}

export function findProfileSurfaceWindow(windows: WindowState[]): WindowState | undefined {
  return windows.find(win => isProfileSurfaceAppId(win.appId));
}

/** 프로필 surface 윈도우에서 subject UUID 추출 (레거시 appId 포함) */
export function resolveProfileSurfaceSubjectUuid(surface: WindowState | undefined): string | undefined {
  if (!surface) {
    return undefined;
  }
  const fromField = surface.userProfileUuid?.trim();
  if (fromField) {
    return fromField;
  }
  return moaShellUserProfileUuidFromAppId(surface.appId) ?? undefined;
}

/** 다른 사용자 프로필로 전환 시 payload·바인딩 캐시 제거 */
export function onProfileSurfaceSubjectChange(
  previousUuid: string | undefined,
  nextUuid: string,
): void {
  if (previousUuid && previousUuid !== nextUuid) {
    clearUserProfilePayloadCache();
    invalidateUserProfileShellBindingCache();
  }
}

export type ProfileSurfaceOpenParams = {
  userUuid: string;
  view: UserProfileWindowView;
  displayName?: string;
};

export function reconcileProfileSurfaceWindows(
  windows: WindowState[],
  params: ProfileSurfaceOpenParams,
  updates?: Partial<WindowState>,
): { windows: WindowState[]; existing: WindowState | null } {
  const existing = findProfileSurfaceWindow(windows);
  const withoutProfiles = purgeProfileSurfaceWindows(windows);

  if (!existing) {
    return { windows: withoutProfiles, existing: null };
  }

  const migrated: WindowState = {
    ...existing,
    appId: SHELL_PROFILE_SURFACE_APP_ID,
    userProfileUuid: params.userUuid,
    userProfileView: params.view,
    title: params.displayName?.trim() || existing.title,
    ...updates,
  };

  return { windows: [...withoutProfiles, migrated], existing: migrated };
}
