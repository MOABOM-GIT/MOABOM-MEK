/** 셸 프로필 표면 싱글톤 appId (사용자 uuid는 win.userProfileUuid) */
export const SHELL_PROFILE_SURFACE_APP_ID = 'moa-shell-surface:profile';

/** @deprecated 레거시 per-user 창 — 신규 오픈 시 제거됨 */
export const MOA_SHELL_USER_PROFILE_APP_ID_PREFIX = 'moa-shell-user:';

/** @deprecated 프로필 surface는 SHELL_PROFILE_SURFACE_APP_ID 사용 */
export function moaShellUserProfileAppId(userUuid: string): string {
  return `${MOA_SHELL_USER_PROFILE_APP_ID_PREFIX}${userUuid}`;
}

export function isMoaShellUserProfileAppId(appId: string): boolean {
  return appId === SHELL_PROFILE_SURFACE_APP_ID
    || appId.startsWith(MOA_SHELL_USER_PROFILE_APP_ID_PREFIX);
}

export function moaShellUserProfileUuidFromAppId(appId: string): string | null {
  if (appId === SHELL_PROFILE_SURFACE_APP_ID) {
    return null;
  }
  if (!appId.startsWith(MOA_SHELL_USER_PROFILE_APP_ID_PREFIX)) {
    return null;
  }
  const uuid = appId.slice(MOA_SHELL_USER_PROFILE_APP_ID_PREFIX.length);
  return uuid.length > 0 ? uuid : null;
}
