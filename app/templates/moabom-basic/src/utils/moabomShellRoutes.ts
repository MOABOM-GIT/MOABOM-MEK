/**
 * Moabom 홈 셸 — REST 스타일 경로 파싱/생성.
 * Laravel `/{any?}` 가 동일 SPA 뷰를 제공하므로 클라이언트에서만 해석합니다.
 *
 * 규칙:
 * - `/` — 셸만 (윈도우 없음과 동기화 시 목표 상태)
 * - `/auth/{login|register|forgot-password|reset-password}`
 * - `/me/{tab}` · `/me` → profile
 * - `/app/{appId}` — 등록된 앱 id (mypage 는 `/me/...` 로 정규화)
 * - `/app/create-app?edit={id}` — 저장 AI 앱 편집
 * - `/board/{slug}` · `/board/{slug}/{postId}` — 게시판 윈도우 (G7 board JSON)
 * - `/users/{uuid}` · `/users/{uuid}/posts` · `/users/{uuid}/chat` — 공개 프로필 윈도우
 */
import type { AuthWindowMode } from '../components/composite/Moa_AuthWindowContent';
import type { MyPageTab } from '../components/composite/mypage/myPageTypes';
import { MY_PAGE_TABS } from '../components/composite/mypage/myPageConstants';
import { isEcommerceMypageSubpath } from './moabomLegacyMypagePaths';
import { createAppShellMetadata } from '../apps/ai-generator/metadata';
import { isGeneratedLibraryAppId } from '../apps/generatedAppLibrary';
import { APPS } from '../data/Moa_apps';
import {
  isMoaShellBoardAppId,
  moaShellBoardSlugFromAppId,
} from '../shell/moaShellBoardIds';
import {
  isMoaShellUserProfileAppId,
  moaShellUserProfileUuidFromAppId,
} from '../shell/moaShellUserProfileIds';
import type { UserProfileWindowView } from '../shell/userProfileWindowLayoutRuntime';
import {
  isMoaShellErrorAppId,
  parseShellErrorCodeFromPath,
  type ShellErrorCode,
} from '../shell/moaShellErrorIds';

const AUTH_MODES: readonly AuthWindowMode[] = ['login', 'register', 'forgot-password', 'reset-password'];
export type BoardShellMode = 'write' | 'edit';

/** 셸 URL `/app/{id}` 로 열 수 있는 앱 id (`create-app` 포함, 저장 AI 앱 id 포함) */
const APP_IDS = new Set([...APPS.map(a => a.id), createAppShellMetadata.id]);

export type { ShellErrorCode } from '../shell/moaShellErrorIds';

export type ParsedShellRoute =
  | { kind: 'home' }
  | { kind: 'auth'; mode: AuthWindowMode }
  | { kind: 'me'; tab: MyPageTab }
  | { kind: 'app'; appId: string; editGeneratedAppId?: number }
  | { kind: 'board'; slug: string; postId?: string; boardMode?: BoardShellMode }
  | { kind: 'userProfile'; uuid: string; view: UserProfileWindowView; page?: number }
  | { kind: 'error'; code: ShellErrorCode }
  | { kind: 'router'; path: string; search?: string };

function isAuthMode(s: string): s is AuthWindowMode {
  return (AUTH_MODES as readonly string[]).includes(s);
}

function isMyPageTab(s: string): s is MyPageTab {
  return (MY_PAGE_TABS as readonly string[]).includes(s);
}

/** 현재 등록된 앱 id 인지 (mypage 포함, 저장 AI 앱 id 포함) */
export function isRegisteredAppId(appId: string): boolean {
  return APP_IDS.has(appId) || isGeneratedLibraryAppId(appId);
}

export function parseCreateAppEditSearchParam(search: string): number | undefined {
  const rawSearch = search.startsWith('?') ? search.slice(1) : search;
  if (!rawSearch) {
    return undefined;
  }
  const value = new URLSearchParams(rawSearch).get('edit');
  if (!value) {
    return undefined;
  }
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

export function parseShellRoute(pathname: string, search = ''): ParsedShellRoute {
  const raw = pathname.trim();
  const p = raw.replace(/\/+$/, '') || '/';
  if (p === '/' || p === '') {
    return { kind: 'home' };
  }

  const parts = p.split('/').filter(Boolean);

  if (parts[0] === 'auth' && parts[1] && isAuthMode(parts[1])) {
    return { kind: 'auth', mode: parts[1] };
  }

  if (parts[0] === 'me') {
    if (parts.length === 1) {
      return { kind: 'me', tab: 'profile' };
    }
    if (parts[1] && isMyPageTab(parts[1])) {
      return { kind: 'me', tab: parts[1] };
    }
    return { kind: 'home' };
  }

  if (parts[0] === 'mypage') {
    if (parts.length === 1) {
      return { kind: 'me', tab: 'profile' };
    }
    const segment = decodeURIComponent(parts[1]);
    if (segment === 'change-password') {
      return { kind: 'me', tab: 'account' };
    }
    if (isMyPageTab(segment)) {
      return { kind: 'me', tab: segment };
    }
    if (isEcommerceMypageSubpath(p)) {
      return { kind: 'router', path: p, search: search || undefined };
    }
    return { kind: 'me', tab: 'profile' };
  }

  if (parts.length === 1) {
    const errorCode = parseShellErrorCodeFromPath(parts[0]);
    if (errorCode) {
      return { kind: 'error', code: errorCode };
    }
  }

  if (parts[0] === 'users' && parts[1]) {
    const uuid = decodeURIComponent(parts[1]);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
      const rawSearch = search.startsWith('?') ? search.slice(1) : search;
      const pageRaw = rawSearch ? new URLSearchParams(rawSearch).get('page') : null;
      const page = pageRaw != null && pageRaw !== '' ? Number(pageRaw) : undefined;
      const pageNum = page != null && Number.isInteger(page) && page > 0 ? page : undefined;
      if (parts[2] === 'posts') {
        return { kind: 'userProfile', uuid, view: 'posts', page: pageNum };
      }
      if (parts[2] === 'chat') {
        return { kind: 'userProfile', uuid, view: 'chat' };
      }
      if (parts.length === 2) {
        return { kind: 'userProfile', uuid, view: 'profile' };
      }
    }
  }

  if (parts[0] === 'board' && parts[1]) {
    const slug = decodeURIComponent(parts[1]);
    if (parts.length === 2) {
      return { kind: 'board', slug };
    }
    const third = decodeURIComponent(parts[2]);
    if (third === 'write') {
      return { kind: 'board', slug, boardMode: 'write' };
    }
    if (parts.length === 4 && parts[3] === 'edit') {
      return { kind: 'board', slug, postId: third, boardMode: 'edit' };
    }
    if (parts.length === 3) {
      return { kind: 'board', slug, postId: third };
    }
    return { kind: 'board', slug };
  }

  if (parts[0] === 'app' && parts[1]) {
    let appId = decodeURIComponent(parts[1]);
    if (appId === 'ai-generator') {
      appId = createAppShellMetadata.id;
    }
    if (appId === 'mypage') {
      return { kind: 'me', tab: 'profile' };
    }
    if (isRegisteredAppId(appId)) {
      const editGeneratedAppId = appId === createAppShellMetadata.id
        ? parseCreateAppEditSearchParam(search)
        : undefined;
      return editGeneratedAppId != null
        ? { kind: 'app', appId, editGeneratedAppId }
        : { kind: 'app', appId };
    }
  }

  return { kind: 'home' };
}

/** @deprecated search 없는 경로만 파싱 — 브라우저 복원은 `parseShellRoute(pathname, search)` 사용 */
export function parseShellPathname(pathname: string): ParsedShellRoute {
  return parseShellRoute(pathname);
}

export function formatShellPath(route: ParsedShellRoute): string {
  switch (route.kind) {
    case 'home':
      return '/';
    case 'auth':
      return `/auth/${route.mode}`;
    case 'me':
      return `/me/${route.tab}`;
    case 'app': {
      const base = `/app/${encodeURIComponent(route.appId)}`;
      if (route.editGeneratedAppId != null && route.editGeneratedAppId > 0) {
        return `${base}?edit=${route.editGeneratedAppId}`;
      }
      return base;
    }
    case 'board': {
      const base = `/board/${encodeURIComponent(route.slug)}`;
      if (route.boardMode === 'write') {
        return `${base}/write`;
      }
      if (route.postId) {
        const postPath = `${base}/${encodeURIComponent(route.postId)}`;
        return route.boardMode === 'edit' ? `${postPath}/edit` : postPath;
      }
      return base;
    }
    case 'userProfile': {
      const base = route.view === 'posts'
        ? `/users/${encodeURIComponent(route.uuid)}/posts`
        : route.view === 'chat'
          ? `/users/${encodeURIComponent(route.uuid)}/chat`
          : `/users/${encodeURIComponent(route.uuid)}`;
      if (route.view === 'posts' && route.page != null && route.page > 1) {
        return `${base}?page=${route.page}`;
      }
      return base;
    }
    case 'error':
      return route.code === 'maintenance' ? '/maintenance' : `/${route.code}`;
    default:
      return '/';
  }
}

/** 공개 프로필 윈도우 URL (페이징 쿼리 포함) */
export function formatUserProfileShellPath(
  uuid: string,
  view: UserProfileWindowView = 'profile',
  search = '',
): string {
  const base = formatShellPath({ kind: 'userProfile', uuid, view });
  if (!search) return base;
  const raw = search.startsWith('?') ? search : `?${search}`;
  return `${base}${raw}`;
}

/** 게시판 윈도우 URL (쿼리·postId 포함) */
export function formatBoardShellPath(slug: string, postId?: string, search = '', boardMode?: BoardShellMode): string {
  const base = formatShellPath({ kind: 'board', slug, postId, boardMode });
  if (!search) return base;
  const raw = search.startsWith('?') ? search : `?${search}`;
  return `${base}${raw}`;
}

export function pushShellPath(path: string): void {
  if (typeof window === 'undefined') return;
  const next = path || '/';
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === next) return;
  window.history.pushState({ moabomShell: true }, '', next);
  window.dispatchEvent(new CustomEvent('moabom-shell-path-changed'));
}

export function replaceShellPath(path: string): void {
  if (typeof window === 'undefined') return;
  const next = path || '/';
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === next) return;
  window.history.replaceState({ moabomShell: true }, '', next);
  window.dispatchEvent(new CustomEvent('moabom-shell-path-changed'));
}

/** 닫기·동기화용 — taskbar 복원 시 URL 과 맞추기 */
export interface ShellWindowPathInput {
  appId: string;
  myPageInitialTab?: MyPageTab;
  editGeneratedAppId?: number;
  boardSlug?: string;
  boardPostId?: string;
  boardMode?: BoardShellMode;
  userProfileUuid?: string;
  userProfileView?: UserProfileWindowView;
  errorCode?: ShellErrorCode;
}

const SHELL_AUTH_IDS = new Set<string>(AUTH_MODES as unknown as string[]);

export function formatShellPathForWindow(win: ShellWindowPathInput): string {
  if (SHELL_AUTH_IDS.has(win.appId)) {
    return formatShellPath({ kind: 'auth', mode: win.appId as AuthWindowMode });
  }
  if (win.appId === 'mypage') {
    return formatShellPath({ kind: 'me', tab: win.myPageInitialTab ?? 'profile' });
  }
  if (win.appId === createAppShellMetadata.id && win.editGeneratedAppId != null) {
    return formatShellPath({
      kind: 'app',
      appId: win.appId,
      editGeneratedAppId: win.editGeneratedAppId,
    });
  }
  if (isMoaShellBoardAppId(win.appId)) {
    const slug = win.boardSlug ?? moaShellBoardSlugFromAppId(win.appId);
    if (slug) {
      return formatShellPath({
        kind: 'board',
        slug,
        postId: win.boardPostId,
        boardMode: win.boardMode,
      });
    }
  }
  if (isMoaShellUserProfileAppId(win.appId)) {
    const uuid = win.userProfileUuid ?? moaShellUserProfileUuidFromAppId(win.appId);
    if (uuid) {
      const view = win.userProfileView ?? 'profile';
      if (typeof window !== 'undefined') {
        const pathname = window.location.pathname.replace(/\/+$/, '');
        const postsPath = `/users/${uuid}/posts`;
        const chatPath = `/users/${uuid}/chat`;
        const profilePath = `/users/${uuid}`;
        if (
          (view === 'posts' && pathname === postsPath)
          || (view === 'chat' && pathname === chatPath)
          || (view === 'profile' && pathname === profilePath)
        ) {
          return formatUserProfileShellPath(uuid, view, window.location.search);
        }
      }
      return formatShellPath({ kind: 'userProfile', uuid, view });
    }
  }
  if (isMoaShellErrorAppId(win.appId) && win.errorCode != null) {
    return formatShellPath({ kind: 'error', code: win.errorCode });
  }
  return formatShellPath({ kind: 'app', appId: win.appId });
}
