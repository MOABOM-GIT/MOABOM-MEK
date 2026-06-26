import type { BoardWindowRenderPayload } from './boardWindowLayoutRuntime';
import { prefetchBoardWindowTranslations } from './boardWindowLayoutRuntime';
import { whenMoabomBootPhaseAtLeast } from '../runtime/moabomShellBootPipeline';
import { deferShellTertiaryWork } from './moaShellDeferredWork';
import { parseQuery } from './moaShellLayoutQuery';
import type { UserProfileWindowView } from './userProfileWindowLayoutRuntime';
import {
  USER_POSTS_LAYOUT_PATH,
  USER_PROFILE_LAYOUT_PATH,
} from './userProfileWindowLayoutRuntime';

const TEMPLATE_ID = 'moabom-basic';

export const USER_PROFILE_SHELL_LAYOUT_PATHS = [
  USER_PROFILE_LAYOUT_PATH,
  USER_POSTS_LAYOUT_PATH,
] as const;

const globalPayloadCache = new Map<string, BoardWindowRenderPayload>();

function getLayoutLoader(): {
  prefetchLayout: (templateId: string, layoutPath: string) => Promise<unknown>;
} | null {
  const templateApp = (window as {
    __templateApp?: { getLayoutLoader?: () => { prefetchLayout?: (t: string, p: string) => Promise<unknown> } | null };
  }).__templateApp;
  const loader = templateApp?.getLayoutLoader?.();
  if (!loader?.prefetchLayout) {
    return null;
  }
  return loader as { prefetchLayout: (templateId: string, layoutPath: string) => Promise<unknown> };
}

function prefetchLayoutPaths(paths: readonly string[]): void {
  const loader = getLayoutLoader();
  if (!loader) {
    return;
  }
  for (const path of paths) {
    void loader.prefetchLayout(TEMPLATE_ID, path);
  }
}

function runUserProfileShellLayoutPrefetch(): void {
  const loader = getLayoutLoader();
  if (!loader) {
    window.setTimeout(runUserProfileShellLayoutPrefetch, 250);
    return;
  }
  prefetchLayoutPaths(USER_PROFILE_SHELL_LAYOUT_PATHS);
  void prefetchBoardWindowTranslations();
}

/** 홈 셸 부트 — handlers-ready 이후 tertiary-idle 큐에서 layout 선로드 */
export function schedulePrefetchUserProfileWindowLayouts(): void {
  if (typeof window === 'undefined') {
    return;
  }

  whenMoabomBootPhaseAtLeast('handlers-ready', () => {
    deferShellTertiaryWork(runUserProfileShellLayoutPrefetch, 200);
  });
}

/** 접속자 메뉴·프로필 윈도우 오픈 직전 — 즉시 선로드 */
export function prefetchUserProfileWindowLayouts(view?: UserProfileWindowView): void {
  if (view === 'posts') {
    prefetchLayoutPaths([USER_POSTS_LAYOUT_PATH, USER_PROFILE_LAYOUT_PATH]);
    return;
  }
  if (view === 'profile') {
    prefetchLayoutPaths([USER_PROFILE_LAYOUT_PATH, USER_POSTS_LAYOUT_PATH]);
    return;
  }
  if (view === 'chat') {
    prefetchLayoutPaths([USER_PROFILE_LAYOUT_PATH]);
    return;
  }
  prefetchLayoutPaths(USER_PROFILE_SHELL_LAYOUT_PATHS);
}

export function resolveUserProfileWindowQuery(
  search = typeof window !== 'undefined' ? window.location.search : '',
): Record<string, string | string[]> {
  return parseQuery(search);
}

export function buildUserProfilePayloadCacheKey(
  userUuid: string,
  view: UserProfileWindowView,
  query: Record<string, string | string[]>,
): string {
  const page = view === 'posts' ? String(query.page ?? '1') : '1';
  return `${userUuid}:${view}:${page}`;
}

export function getCachedUserProfilePayload(
  cacheKey: string,
): BoardWindowRenderPayload | undefined {
  return globalPayloadCache.get(cacheKey);
}

export function setCachedUserProfilePayload(
  cacheKey: string,
  payload: BoardWindowRenderPayload,
): void {
  globalPayloadCache.set(cacheKey, payload);
}

export function clearUserProfilePayloadCache(): void {
  globalPayloadCache.clear();
}

/** 탭 전환 시 profile 뷰 URL — page 쿼리 제거 */
export function resolveUserProfileShellSearch(
  view: UserProfileWindowView,
  search = typeof window !== 'undefined' ? window.location.search : '',
): string {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  if (!raw) {
    return '';
  }
  const params = new URLSearchParams(raw);
  if (view === 'profile' || view === 'chat') {
    params.delete('page');
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
