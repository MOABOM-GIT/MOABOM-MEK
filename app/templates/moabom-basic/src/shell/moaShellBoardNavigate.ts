import type { AuthWindowMode } from '../components/composite/Moa_AuthWindowContent';
import {
  formatBoardShellPath,
  parseShellRoute,
  pushShellPath,
  replaceShellPath,
  type ParsedShellRoute,
} from '../utils/moabomShellRoutes';
import type { MoaShellBoardBridge } from './moaShellBoardBridge';
import { isMoabomShellHomeMounted } from './moaShellErrorBridge';

const AUTH_MODES: readonly AuthWindowMode[] = ['login', 'register', 'forgot-password', 'reset-password'];

function isAuthMode(s: string): s is AuthWindowMode {
  return (AUTH_MODES as readonly string[]).includes(s);
}

/** G7 board JSON·레거시 경로 → 셸 인증 모드 */
export function resolveShellAuthModeFromPath(pathname: string): AuthWindowMode | null {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/login') return 'login';
  if (p === '/register') return 'register';
  if (p === '/forgot-password') return 'forgot-password';
  if (p === '/reset-password') return 'reset-password';

  const parts = p.split('/').filter(Boolean);
  if (parts[0] === 'auth' && parts[1] && isAuthMode(parts[1])) {
    return parts[1];
  }

  return null;
}

export function splitPathAndSearch(pathWithQuery: string): { pathname: string; search: string } {
  const q = pathWithQuery.indexOf('?');
  if (q === -1) {
    return { pathname: pathWithQuery, search: '' };
  }
  return {
    pathname: pathWithQuery.slice(0, q),
    search: pathWithQuery.slice(q),
  };
}

/**
 * 게시판 윈도우가 열린 상태에서 router.navigate / updateQueryParams 를 셸 동작으로 변환.
 * @returns true 이면 코어 Router 호출을 생략한다.
 */
export function tryHandleBoardShellNavigate(
  pathWithQuery: string,
  bridge: MoaShellBoardBridge,
  options?: { replace?: boolean },
): boolean {
  const { pathname, search } = splitPathAndSearch(pathWithQuery);
  const route: ParsedShellRoute = parseShellRoute(pathname, search);
  const shellPath = search ? `${pathname}${search}` : pathname;

  if (route.kind === 'app') {
    if (bridge.openAppById) {
      bridge.openAppById(route.appId, { shellPath, replace: options?.replace === true });
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

  if (route.kind === 'me') {
    if (bridge.openMyPage) {
      bridge.openMyPage(route.tab, { shellPath, replace: options?.replace === true });
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

  if (!isMoabomShellHomeMounted() && !bridge.isActive()) {
    return false;
  }

  const authMode = resolveShellAuthModeFromPath(pathname);
  if (authMode) {
    bridge.openAuth(authMode);
    return true;
  }

  if (route.kind === 'board') {
    bridge.openBoard(route.slug, route.postId, {
      shellPath,
      replace: options?.replace === true,
      boardMode: route.boardMode,
    });
    return true;
  }

  if (route.kind === 'userProfile' && bridge.openUserProfile) {
    const shellPath = search ? `${pathname}${search}` : pathname;
    bridge.openUserProfile(route.uuid, route.view, {
      shellPath,
      replace: options?.replace === true,
    });
    return true;
  }

  return false;
}

/** navigate params.query + mergeQuery 를 반영한 최종 경로 (ActionDispatcher.handleNavigate 와 동일 규칙) */
export function buildBoardNavigatePath(
  targetPath: string,
  params: {
    mergeQuery?: boolean;
    query?: Record<string, unknown>;
  },
  currentSearch = typeof window !== 'undefined' ? window.location.search : '',
): string {
  let finalPath = targetPath;
  if (!params.query) {
    return finalPath;
  }

  if (params.mergeQuery === true) {
    const [base, existingQs] = targetPath.split('?');
    const merged = new URLSearchParams(existingQs ?? '');
    const current = new URLSearchParams(currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch);
    for (const [key, value] of current.entries()) {
      if (!merged.has(key)) {
        merged.set(key, value);
      }
    }
    for (const [key, value] of Object.entries(params.query)) {
      if (value === undefined || value === null || value === '') {
        merged.delete(key);
        continue;
      }
      if (Array.isArray(value)) {
        merged.delete(key);
        const arrayKey = key.endsWith('[]') ? key : `${key}[]`;
        for (const item of value) {
          if (item !== undefined && item !== null && item !== '') {
            merged.append(arrayKey, String(item));
          }
        }
      } else {
        merged.set(key, String(value));
      }
    }
    const qs = merged.toString();
    finalPath = qs ? `${base}?${qs}` : base;
    return finalPath;
  }

  const queryString = new URLSearchParams();
  for (const [key, value] of Object.entries(params.query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      const arrayKey = key.endsWith('[]') ? key : `${key}[]`;
      for (const item of value) {
        if (item !== undefined && item !== null && item !== '') {
          queryString.append(arrayKey, String(item));
        }
      }
    } else {
      queryString.set(key, String(value));
    }
  }
  const qs = queryString.toString();
  if (qs) {
    finalPath = `${targetPath}?${qs}`;
  }
  return finalPath;
}

export function boardShellPathFromRoute(slug: string, postId?: string, search?: string): string {
  return formatBoardShellPath(slug, postId, search);
}
