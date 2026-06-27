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

/** users/show·users/posts data_source id — G7 단순 경로 바인딩 캐시 선택 무효화 */
const USER_PROFILE_SHELL_DATA_SOURCE_IDS = [
  'profile',
  'postStats',
  'recentPosts',
  'userProfile',
  'userPosts',
] as const;

type ShellBindingEngineLike = {
  invalidateCacheByKeys?: (keys: string[]) => void;
  clearCache?: () => void;
};

/**
 * 프로필 subject 전환 시 G7 DataBindingEngine의 profile 관련 경로 캐시만 무효화.
 * 추가 API 호출 없음 — `{{profile.data}}` 등 단순 바인딩이 이전 사용자에 고정되는 것을 방지.
 */
export function invalidateUserProfileShellBindingCache(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const engine = (window as { G7Core?: { getDataBindingEngine?: () => ShellBindingEngineLike | null } })
    .G7Core?.getDataBindingEngine?.();
  if (!engine) {
    return;
  }

  if (typeof engine.invalidateCacheByKeys === 'function') {
    engine.invalidateCacheByKeys([...USER_PROFILE_SHELL_DATA_SOURCE_IDS]);
    return;
  }

  engine.clearCache?.();
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
