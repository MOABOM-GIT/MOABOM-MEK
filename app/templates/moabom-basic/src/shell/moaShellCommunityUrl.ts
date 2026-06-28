import { generatedAppLibraryId } from '../apps/generatedAppLibrary';
import { formatShellPath } from '../utils/moabomShellRoutes';
import { isMoaShellAppCommunityAppId, parseAppCommunityServerId } from './moaShellAppCommunityIds';

export interface AppCommunityShellWindowRef {
  appId: string;
  appCommunityServerId?: number;
}

/** 앱 리뷰 창은 URL-less 오버레이 — 부모 생성앱 경로를 셸 URL SSOT로 사용 */
export function resolveAppCommunityServerId(win: AppCommunityShellWindowRef): number | null {
  return win.appCommunityServerId ?? parseAppCommunityServerId(win.appId);
}

export function resolveAppCommunityParentAppId(win: AppCommunityShellWindowRef): string | null {
  const serverId = resolveAppCommunityServerId(win);
  if (serverId == null) {
    return null;
  }

  return generatedAppLibraryId(serverId);
}

export function formatAppCommunityShellPath(win: AppCommunityShellWindowRef): string {
  const parentAppId = resolveAppCommunityParentAppId(win);
  if (parentAppId == null) {
    return '/';
  }

  return formatShellPath({ kind: 'app', appId: parentAppId });
}

export function isAppCommunityShellWindow(win: AppCommunityShellWindowRef): boolean {
  return isMoaShellAppCommunityAppId(win.appId);
}
