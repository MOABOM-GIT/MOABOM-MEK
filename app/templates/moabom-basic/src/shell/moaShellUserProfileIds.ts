/** 셸 전용 공개 프로필 윈도우 가상 앱 ID (`moa-shell-user:{uuid}`) */
export const MOA_SHELL_USER_PROFILE_APP_ID_PREFIX = 'moa-shell-user:';

export function moaShellUserProfileAppId(userUuid: string): string {
  return `${MOA_SHELL_USER_PROFILE_APP_ID_PREFIX}${userUuid}`;
}

export function isMoaShellUserProfileAppId(appId: string): boolean {
  return appId.startsWith(MOA_SHELL_USER_PROFILE_APP_ID_PREFIX);
}

export function moaShellUserProfileUuidFromAppId(appId: string): string | null {
  if (!isMoaShellUserProfileAppId(appId)) {
    return null;
  }
  const uuid = appId.slice(MOA_SHELL_USER_PROFILE_APP_ID_PREFIX.length);
  return uuid.length > 0 ? uuid : null;
}
