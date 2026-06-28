import type { MoaShellBoardBridge } from './moaShellBoardBridge';
import { tryHandleBoardShellNavigate } from './moaShellBoardNavigate';

/**
 * G7 `navigate` / `updateQueryParams` 패치용 — 셸 브릿지 실패 시 코어 Router로 전파하지 않는다.
 * (ActionDispatcher `Failed to execute action: navigate` 토스트 방지)
 */
export function safeTryHandleBoardShellNavigate(
  pathWithQuery: string,
  bridge: MoaShellBoardBridge,
  options?: { replace?: boolean },
): boolean {
  try {
    return tryHandleBoardShellNavigate(pathWithQuery, bridge, options);
  } catch (error) {
    console.error('[moabom] shell board navigate bridge failed', { pathWithQuery, error });
    return false;
  }
}
