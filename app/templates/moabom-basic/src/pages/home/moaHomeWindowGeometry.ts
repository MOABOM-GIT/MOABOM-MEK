import type { WindowState } from '../../components/composite/Moa_CenterPanel';
import { MAX_OPEN_WINDOWS, WINDOW_CASCADE_STEP } from './moaHomeConstants';

export function getNewWindowPosition(
  width: number,
  height: number,
  openCount: number,
): { initialX: number; initialY: number } {
  const targetWidth = Math.min(width, Math.max(400, window.innerWidth - 40));
  const targetHeight = Math.min(height, Math.max(300, window.innerHeight - 40));
  const centerX = Math.max(0, (window.innerWidth - targetWidth) / 2);
  const centerY = Math.max(0, (window.innerHeight - targetHeight) / 2);

  if (openCount === 0) {
    return {
      initialX: centerX,
      initialY: centerY,
    };
  }

  const cascade = Math.min(openCount - 1, MAX_OPEN_WINDOWS - 2) * WINDOW_CASCADE_STEP;

  return {
    initialX: Math.max(0, centerX - WINDOW_CASCADE_STEP - cascade),
    initialY: Math.max(0, centerY - WINDOW_CASCADE_STEP - cascade),
  };
}

export function getCenteredWindowPosition(
  width: number,
  height: number,
): { initialX: number; initialY: number } {
  const targetWidth = Math.min(width, Math.max(400, window.innerWidth - 40));
  const targetHeight = Math.min(height, Math.max(300, window.innerHeight - 40));

  return {
    initialX: Math.max(0, (window.innerWidth - targetWidth) / 2),
    initialY: Math.max(0, (window.innerHeight - targetHeight) / 2),
  };
}

export function countOpenWindows(windows: WindowState[]): number {
  return windows.filter(w => !w.isMinimized).length;
}
