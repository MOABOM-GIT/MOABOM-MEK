import { parseShellRoute, pushShellPath, replaceShellPath } from '../utils/moabomShellRoutes';
import { getMoaShellBoardBridge } from './moaShellBoardBridge';
import { splitPathAndSearch } from './moaShellBoardNavigate';
import { openMoabomShellApp } from './openMoabomShellApp';
import { isMoabomShellHomeMounted } from './moaShellErrorBridge';
import type { MyPageTab } from '../components/composite/mypage/myPageTypes';

/**
 * 셸 내부 경로로 이동한다. G7 Router·dispatch navigate 를 우회한다.
 * @returns true — 셸이 처리함(또는 브릿지 위임). false — G7/풀 페이지 폴백 필요.
 */
export function navigateMoabomShellPath(pathWithQuery: string, options?: { replace?: boolean }): boolean {
  const trimmed = pathWithQuery.trim();
  if (!trimmed || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return false;
  }

  const { pathname, search } = splitPathAndSearch(trimmed);
  const route = parseShellRoute(pathname, search);
  const shellPath = search ? `${pathname}${search}` : pathname;

  if (route.kind === 'app') {
    openMoabomShellApp(route.appId, { replace: options?.replace });
    return true;
  }

  if (route.kind === 'me') {
    const bridge = getMoaShellBoardBridge();
    if (bridge?.openMyPage) {
      bridge.openMyPage(route.tab, { shellPath, replace: options?.replace });
      return true;
    }
    if (isMoabomShellHomeMounted()) {
      if (options?.replace) {
        replaceShellPath(shellPath);
      } else {
        pushShellPath(shellPath);
      }
      return true;
    }
    return false;
  }

  if (route.kind === 'home' || route.kind === 'router') {
    return false;
  }

  if (!isMoabomShellHomeMounted()) {
    return false;
  }

  if (options?.replace) {
    replaceShellPath(shellPath);
  } else {
    pushShellPath(shellPath);
  }
  return true;
}

export type { MyPageTab };
