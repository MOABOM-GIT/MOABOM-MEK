/** 앱 리뷰 셸 창 appId SSOT — `app-community-{serverId}` */
export const APP_COMMUNITY_WINDOW_PREFIX = 'app-community-';

export function moaShellAppCommunityAppId(serverId: number): string {
  return `${APP_COMMUNITY_WINDOW_PREFIX}${serverId}`;
}

export function parseAppCommunityServerId(appId: string): number | null {
  if (!appId.startsWith(APP_COMMUNITY_WINDOW_PREFIX)) {
    return null;
  }
  const raw = appId.slice(APP_COMMUNITY_WINDOW_PREFIX.length);
  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function isMoaShellAppCommunityAppId(appId: string): boolean {
  return parseAppCommunityServerId(appId) !== null;
}
