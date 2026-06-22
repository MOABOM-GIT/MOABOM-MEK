import type { ShellErrorCode } from './moaShellErrorIds';
import { isMoaShellErrorAppId } from './moaShellErrorIds';

export interface MoaShellErrorOpenOptions {
  shellPath?: string;
  replace?: boolean;
  /** false 이면 URL 동기화 생략 (bootstrap·직접 /404 접속) */
  skipUrl?: boolean;
}

export interface MoaShellErrorBridge {
  isActive: () => boolean;
  /** @returns 윈도우가 열리거나 포커스됐으면 true */
  openError: (code: ShellErrorCode, options?: MoaShellErrorOpenOptions) => boolean;
  closeError: () => void;
}

export function setPendingShellError(code: ShellErrorCode): void {
  if (typeof window === 'undefined') return;
  (window as { __moabomPendingShellError?: ShellErrorCode }).__moabomPendingShellError = code;
}

export function takePendingShellError(): ShellErrorCode | null {
  if (typeof window === 'undefined') return null;
  const win = window as { __moabomPendingShellError?: ShellErrorCode };
  const pending = win.__moabomPendingShellError ?? null;
  delete win.__moabomPendingShellError;
  return pending;
}

export function getMoaShellErrorBridge(): MoaShellErrorBridge | null {
  return (window as { __moabomShellErrorBridge?: MoaShellErrorBridge | null }).__moabomShellErrorBridge ?? null;
}

export function isAnyErrorShellWindowOpen(windows: Array<{ appId: string }>): boolean {
  return windows.some(w => isMoaShellErrorAppId(w.appId));
}

/** HomePage 마운트 여부 — ErrorPageHandler 가로채기용 */
export function markMoabomShellHomeMounted(active: boolean): void {
  if (typeof window === 'undefined') return;
  (window as { __moabomShellHomeMounted?: boolean }).__moabomShellHomeMounted = active;
}

export function isMoabomShellHomeMounted(): boolean {
  if (typeof window === 'undefined') return false;
  return (window as { __moabomShellHomeMounted?: boolean }).__moabomShellHomeMounted === true;
}
