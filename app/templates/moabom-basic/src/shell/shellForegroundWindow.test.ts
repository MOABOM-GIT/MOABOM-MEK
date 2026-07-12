import { describe, expect, it } from 'vitest';
import type { WindowState } from '../components/composite/Moa_CenterPanel';
import {
  resolveForegroundShellWindow,
  shouldKeepMinimizedShellWindowsAlive,
} from './shellForegroundWindow';

function win(partial: Partial<WindowState> & Pick<WindowState, 'id' | 'appId'>): WindowState {
  return {
    title: partial.title ?? partial.appId,
    icon: partial.icon ?? 'cube',
    gradient: partial.gradient ?? 'none',
    zIndex: partial.zIndex ?? 1,
    isMaximized: partial.isMaximized ?? false,
    isMinimized: partial.isMinimized ?? false,
    initialX: partial.initialX ?? 0,
    initialY: partial.initialY ?? 0,
    ...partial,
  };
}

describe('resolveForegroundShellWindow', () => {
  it('보이는 창만 foreground로 고른다', () => {
    const items = [
      win({ id: 'a', appId: 'notes', zIndex: 1, isMinimized: false }),
      win({ id: 'b', appId: 'create-app', zIndex: 9, isMinimized: true }),
    ];
    expect(resolveForegroundShellWindow(items)?.id).toBe('a');
  });

  it('최소화된 창만 있으면 null — home이 앱 URL로 되돌리지 않음', () => {
    const items = [
      win({
        id: 'notes-1',
        appId: 'notes',
        zIndex: 5,
        isMinimized: true,
      }),
    ];
    expect(resolveForegroundShellWindow(items)).toBeNull();
  });
});

describe('shouldKeepMinimizedShellWindowsAlive', () => {
  it('busy면 유지', () => {
    expect(shouldKeepMinimizedShellWindowsAlive([], true)).toBe(true);
  });

  it('임의 앱이 최소화되어 있으면 busy가 아니어도 유지', () => {
    const items = [
      win({
        id: 'notes-1',
        appId: 'notes',
        isMinimized: true,
      }),
    ];
    expect(shouldKeepMinimizedShellWindowsAlive(items, false)).toBe(true);
  });

  it('보이는 창만 있으면 유지하지 않음', () => {
    const items = [win({ id: 'a', appId: 'notes', isMinimized: false })];
    expect(shouldKeepMinimizedShellWindowsAlive(items, false)).toBe(false);
  });
});
