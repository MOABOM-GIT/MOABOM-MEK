import { describe, expect, it } from 'vitest';
import { commitShellWindows } from '../shellWindowsCommit';
import type { WindowState } from '../../components/composite/Moa_CenterPanel';

function makeRef(initial: WindowState[] = []) {
  return { current: initial };
}

describe('commitShellWindows', () => {
  it('windowsRef를 setState보다 먼저 갱신한다', () => {
    const ref = makeRef();
    let committed: WindowState[] | null = null;

    const next = commitShellWindows(ref, (value) => {
      committed = typeof value === 'function' ? value(ref.current) : value;
    }, prev => [...prev, {
      id: 'board-1',
      appId: 'moa-shell-board:notice',
      title: 'notice',
      icon: 'comments',
      gradient: 'none',
      zIndex: 1,
      isMaximized: false,
      isMinimized: false,
      initialX: 0,
      initialY: 0,
    }]);

    expect(ref.current).toBe(next);
    expect(ref.current).toHaveLength(1);
    expect(committed).toBe(next);
  });
});
