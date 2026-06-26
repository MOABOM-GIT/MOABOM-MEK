import type { BoardWindowMode } from './boardWindowLayoutRuntime';
import { prefetchBoardWindowTranslations } from './boardWindowLayoutRuntime';
import { whenMoabomBootPhaseAtLeast } from '../runtime/moabomShellBootPipeline';
import { deferShellTertiaryWork } from './moaShellDeferredWork';
import { parseQuery } from './moaShellLayoutQuery';
import { MOA_SHELL_NOTICE_BOARD_SLUG } from './moaShellNoticeBoard';

const TEMPLATE_ID = 'moabom-basic';

export const BOARD_SHELL_LAYOUT_PATHS = ['board/index', 'board/show', 'board/form'] as const;

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

function runBoardShellLayoutPrefetch(): void {
  const loader = getLayoutLoader();
  if (!loader) {
    window.setTimeout(runBoardShellLayoutPrefetch, 250);
    return;
  }
  prefetchLayoutPaths(['board/index', 'board/show']);
  void prefetchBoardWindowTranslations();
}

/** 홈 셸 부트 — handlers-ready 이후 tertiary-idle 큐에서 layout 선로드 */
export function schedulePrefetchBoardWindowLayouts(): void {
  if (typeof window === 'undefined') {
    return;
  }

  whenMoabomBootPhaseAtLeast('handlers-ready', () => {
    deferShellTertiaryWork(runBoardShellLayoutPrefetch, 200);
  });
}

/** 게시판 윈도우 오픈 직전·좌측 공지 탭 — 즉시 선로드 */
export function prefetchBoardWindowLayouts(
  slug: string,
  postId?: string,
  mode?: BoardWindowMode,
): void {
  if (mode === 'write' || mode === 'edit') {
    prefetchLayoutPaths(['board/form']);
    return;
  }
  if (postId) {
    prefetchLayoutPaths(['board/show']);
    return;
  }
  prefetchLayoutPaths(['board/index']);
  if (slug === MOA_SHELL_NOTICE_BOARD_SLUG) {
    void getLayoutLoader()?.prefetchLayout(TEMPLATE_ID, 'board/show');
  }
}

export function resolveBoardWindowQuery(
  search = typeof window !== 'undefined' ? window.location.search : '',
): Record<string, string | string[]> {
  return parseQuery(search);
}

export function buildBoardPayloadCacheKey(
  slug: string,
  postId: string | undefined,
  mode: BoardWindowMode | undefined,
  query: Record<string, string | string[]>,
  authKey: string,
): string {
  const page = String(query.page ?? '1');
  return `${slug}:${postId ?? ''}:${mode ?? ''}:${page}:${authKey}`;
}
