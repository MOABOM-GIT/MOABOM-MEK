import type { WindowState } from '../components/composite/Moa_CenterPanel';
import type { Moa_ShellWindowRendererProps } from '../pages/home/Moa_ShellWindowRenderer';

/** 창 콘텐츠 리렌더에 영향 주는 `WindowState` 필드만 직렬화 */
export function buildShellWindowRenderFingerprint(win: WindowState): string {
  return [
    win.id,
    win.appId,
    win.boardSlug ?? '',
    win.boardPostId ?? '',
    win.boardMode ?? '',
    win.myPageInitialTab ?? '',
    win.errorCode ?? '',
    String(win.appCommunityServerId ?? ''),
    win.appCommunityTitle ?? '',
    String(win.editGeneratedAppId ?? ''),
    win.userProfileUuid ?? '',
    win.userProfileView ?? '',
  ].join('\0');
}

function isMyPageWindow(win: WindowState): boolean {
  return win.appId === 'mypage';
}

/**
 * 열린 창별 불필요 리렌더 차단 — z-index·포커스 등 크롬 변경은 제외.
 * 마이페이지만 `currentUser`·카탈로그 전체 비교, 그 외는 `authStateKey`만 비교.
 */
export function areShellWindowRendererPropsEqual(
  prev: Moa_ShellWindowRendererProps,
  next: Moa_ShellWindowRendererProps,
): boolean {
  if (prev.compactWindow !== next.compactWindow) {
    return false;
  }
  if (prev.t !== next.t) {
    return false;
  }
  if (buildShellWindowRenderFingerprint(prev.win) !== buildShellWindowRenderFingerprint(next.win)) {
    return false;
  }

  if (isMyPageWindow(prev.win)) {
    if (prev.isLoggedIn !== next.isLoggedIn) {
      return false;
    }
    if (prev.currentUser !== next.currentUser) {
      return false;
    }
    if (prev.createdApps !== next.createdApps) {
      return false;
    }
    if (prev.createdAppsLoading !== next.createdAppsLoading) {
      return false;
    }
    if (prev.favoriteApps !== next.favoriteApps) {
      return false;
    }
    if (prev.recentApps !== next.recentApps) {
      return false;
    }
    if (prev.shellSystem !== next.shellSystem) {
      return false;
    }
  } else if (prev.authStateKey !== next.authStateKey) {
    return false;
  }

  return true;
}
