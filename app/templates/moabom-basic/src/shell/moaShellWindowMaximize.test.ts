import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveShellWindowMaximized,
  saveShellWindowMaximized,
} from './moaShellWindowMaximize';
import {
  STORAGE_KEY_APP_MAXIMIZED,
  STORAGE_KEY_SHELL_WINDOWS_MAXIMIZED,
} from './moaShellLayoutConstants';

describe('moaShellWindowMaximize', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('저장값 없으면 비최대화', () => {
    expect(resolveShellWindowMaximized()).toBe(false);
  });

  it('한 창이라도 최대화하면 모든 창이 true', () => {
    saveShellWindowMaximized(true);
    expect(resolveShellWindowMaximized()).toBe(true);
  });

  it('복원하면 전역 false', () => {
    saveShellWindowMaximized(true);
    saveShellWindowMaximized(false);
    expect(resolveShellWindowMaximized()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY_SHELL_WINDOWS_MAXIMIZED)).toBe('false');
  });

  it('구 앱별 맵에 true가 있으면 전역 true로 읽는다', () => {
    localStorage.setItem(STORAGE_KEY_APP_MAXIMIZED, JSON.stringify({ consulting: true }));
    expect(resolveShellWindowMaximized()).toBe(true);
  });

  it('localStorage 쓰기 실패 시 예외 없이 동작', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => saveShellWindowMaximized(true)).not.toThrow();
    expect(resolveShellWindowMaximized()).toBe(false);
  });
});
