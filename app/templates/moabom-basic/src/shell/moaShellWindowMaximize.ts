/** 셸 윈도우 전역 최대화 선호 — localStorage (게스트·로그인 공통) */

import { STORAGE_KEY_APP_MAXIMIZED, STORAGE_KEY_SHELL_WINDOWS_MAXIMIZED } from './moaShellLayoutConstants';
import { loadJson } from './moaShellLocalStorage';

function readLegacyPerAppMaximized(): boolean {
  const legacy = loadJson<Record<string, boolean>>(STORAGE_KEY_APP_MAXIMIZED, {});
  return Object.values(legacy).some(v => v === true);
}

/** 새 창을 열 때 적용할 최대화 여부 (기본 false). */
export function resolveShellWindowMaximized(): boolean {
  try {
    if (localStorage.getItem(STORAGE_KEY_SHELL_WINDOWS_MAXIMIZED) !== null) {
      return loadJson<boolean>(STORAGE_KEY_SHELL_WINDOWS_MAXIMIZED, false);
    }
    return readLegacyPerAppMaximized();
  } catch {
    return false;
  }
}

/** 사용자가 아무 창이든 최대화/복원할 때 전역 선호를 갱신한다. */
export function saveShellWindowMaximized(maximized: boolean): void {
  try {
    if (maximized) {
      localStorage.setItem(STORAGE_KEY_SHELL_WINDOWS_MAXIMIZED, JSON.stringify(true));
      return;
    }
    localStorage.setItem(STORAGE_KEY_SHELL_WINDOWS_MAXIMIZED, JSON.stringify(false));
  } catch {
    /* in-app WebView 등 저장 불가 시 해당 세션만 기본(비최대화) */
  }
}
