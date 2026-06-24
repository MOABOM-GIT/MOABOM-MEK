import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { WindowState } from '../components/composite/Moa_CenterPanel';

/**
 * 셸 윈도우 상태를 React state와 windowsRef에 동시에 반영한다.
 * pushShellPath → applyShellRoute 재진입 시 windowsRef가 useEffect보다 먼저 최신이어야
 * 동일 appId 창이 두 번 열리지 않는다.
 */
export function commitShellWindows(
  windowsRef: MutableRefObject<WindowState[]>,
  setWindows: Dispatch<SetStateAction<WindowState[]>>,
  updater: (prev: WindowState[]) => WindowState[],
): WindowState[] {
  const next = updater(windowsRef.current);
  windowsRef.current = next;
  setWindows(next);
  return next;
}
