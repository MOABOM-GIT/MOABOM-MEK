/** 셸 전용 게시판 윈도우 가상 앱 ID (`moa-shell-board:{slug}`) */
export const MOA_SHELL_BOARD_APP_ID_PREFIX = 'moa-shell-board:';

export function moaShellBoardAppId(slug: string): string {
  return `${MOA_SHELL_BOARD_APP_ID_PREFIX}${slug}`;
}

export function isMoaShellBoardAppId(appId: string): boolean {
  return appId.startsWith(MOA_SHELL_BOARD_APP_ID_PREFIX);
}

export function moaShellBoardSlugFromAppId(appId: string): string | null {
  if (!isMoaShellBoardAppId(appId)) {
    return null;
  }
  const slug = appId.slice(MOA_SHELL_BOARD_APP_ID_PREFIX.length);
  return slug.length > 0 ? slug : null;
}
