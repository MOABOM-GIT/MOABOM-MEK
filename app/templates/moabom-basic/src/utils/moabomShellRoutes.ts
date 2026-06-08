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
 */
import type { AuthWindowMode } from '../components/composite/Moa_AuthWindowContent';
import type { MyPageTab } from '../components/composite/mypage/myPageTypes';
import { createAppShellMetadata } from '../apps/ai-generator/metadata';
import { isGeneratedLibraryAppId } from '../apps/generatedAppLibrary';
import { APPS } from '../data/Moa_apps';

const AUTH_MODES: readonly AuthWindowMode[] = ['login', 'register', 'forgot-password', 'reset-password'];

const MY_PAGE_TABS: readonly MyPageTab[] = [
  'profile',
  'settings',
  'credit',
  'library',
  'activity',
  'account',
  'subscription',
];

/** 셸 URL `/app/{id}` 로 열 수 있는 앱 id (`create-app` 은 `APPS` 밖 셸 전용) */
const APP_IDS = new Set([...APPS.map(a => a.id), createAppShellMetadata.id]);

export type ParsedShellRoute =
  | { kind: 'home' }
  | { kind: 'auth'; mode: AuthWindowMode }
  | { kind: 'me'; tab: MyPageTab }
  | { kind: 'app'; appId: string; editGeneratedAppId?: number };

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
    default:
      return '/';
  }
}

export function pushShellPath(path: string): void {
  if (typeof window === 'undefined') return;
  const next = path || '/';
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === next) return;
  window.history.pushState({ moabomShell: true }, '', next);
}

export function replaceShellPath(path: string): void {
  if (typeof window === 'undefined') return;
  const next = path || '/';
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === next) return;
  window.history.replaceState({ moabomShell: true }, '', next);
}

/** 닫기·동기화용 — taskbar 복원 시 URL 과 맞추기 */
export interface ShellWindowPathInput {
  appId: string;
  myPageInitialTab?: MyPageTab;
  editGeneratedAppId?: number;
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
  return formatShellPath({ kind: 'app', appId: win.appId });
}
