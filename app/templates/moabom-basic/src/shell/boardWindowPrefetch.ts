import type { BoardWindowMode } from './boardWindowLayoutRuntime';
import { prefetchBoardWindowTranslations } from './boardWindowLayoutRuntime';
import { whenMoabomBootPhaseAtLeast } from '../runtime/moabomShellBootPipeline';
import { deferShellTertiaryWork } from './moaShellDeferredWork';
import { parseQuery } from './moaShellLayoutQuery';

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
  // layout JSON 만 — 부트 critical/API 큐와 무관. form 포함으로 첫 작성 체감 완화.
  prefetchLayoutPaths(BOARD_SHELL_LAYOUT_PATHS);
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

/**
 * 게시판 윈도우 오픈 직전·좌측 공지 탭 — layout JSON 선로드.
 * (글 API prefetch / hover 는 모바일·안정성상 하지 않음)
 */
export function prefetchBoardWindowLayouts(
  slug: string,
  postId?: string,
  mode?: BoardWindowMode,
): void {
  void slug;
  if (mode === 'write' || mode === 'edit') {
    prefetchLayoutPaths(['board/form']);
    return;
  }
  if (postId) {
    // 상세 진입 — 목록 복귀·수정 대비
    prefetchLayoutPaths(['board/show', 'board/index', 'board/form']);
    return;
  }
  // 목록 진입 — 상세·작성 전환 대비 (모바일 touch 에도 layout 캐시 히트)
  prefetchLayoutPaths(['board/index', 'board/show', 'board/form']);
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
