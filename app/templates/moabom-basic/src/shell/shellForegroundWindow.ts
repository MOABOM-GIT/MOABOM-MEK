import type { WindowState } from '../components/composite/Moa_CenterPanel';

/**
 * URL·포커스용 foreground. 최소화된 창은 제외한다.
 * 최소화 창으로 fallback 하면 home(`/`) 동기화가 앱 URL로 되돌아가
 * 최소화가 풀리며 마운트 유지 정책이 깨진다.
 */
export function resolveForegroundShellWindow(items: WindowState[]): WindowState | null {
  const visible = items.filter(item => !item.isMinimized);
  if (visible.length === 0) {
    return null;
  }
  return [...visible].sort((a, b) => b.zIndex - a.zIndex)[0] ?? null;
}

/**
 * home/router 클리어 시 최소화된 창(상태 유지) 또는 AI 생성 busy를 남겨야 하는지.
 * @deprecated 이름만 호환 — shouldKeepMinimizedShellWindowsAlive 사용
 */
export function shouldKeepCreateAppWindowsAlive(
  windows: WindowState[],
  isBusy: boolean,
): boolean {
  return shouldKeepMinimizedShellWindowsAlive(windows, isBusy);
}

/** home/router 에서 windows 를 비우면 최소화 앱 React 상태가 소실된다 */
export function shouldKeepMinimizedShellWindowsAlive(
  windows: WindowState[],
  isBusy: boolean,
): boolean {
  if (isBusy) {
    return true;
  }
  return windows.some(w => Boolean(w.isMinimized));
}
