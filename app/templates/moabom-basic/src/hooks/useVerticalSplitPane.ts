import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';

const STORAGE_KEY = 'moa-ai-gen-split-ratio';
const DEFAULT_RATIO = 0.42;
const MIN_RATIO = 0.18;
const MAX_RATIO = 0.72;

function clampRatio(value: number): number {
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, value));
}

function readStoredRatio(): number {
  if (typeof window === 'undefined') {
    return DEFAULT_RATIO;
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number.parseFloat(raw) : NaN;
    return Number.isFinite(parsed) ? clampRatio(parsed) : DEFAULT_RATIO;
  } catch {
    return DEFAULT_RATIO;
  }
}

export interface UseVerticalSplitPaneOptions {
  /** 세로 스택(모바일)에서는 분할 비활성 */
  enabled?: boolean;
}

export function useVerticalSplitPane({ enabled = true }: UseVerticalSplitPaneOptions = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ratio, setRatio] = useState(readStoredRatio);
  const draggingRef = useRef(false);

  const persistRatio = useCallback((next: number) => {
    const clamped = clampRatio(next);
    setRatio(clamped);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      // ignore
    }
  }, []);

  const applyPointerRatio = useCallback((clientY: number) => {
    const container = containerRef.current;
    if (!container || !enabled) {
      return;
    }
    const rect = container.getBoundingClientRect();
    if (rect.height <= 0) {
      return;
    }
    const next = (clientY - rect.top) / rect.height;
    persistRatio(next);
  }, [enabled, persistRatio]);

  const onHandlePointerDown = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    if (!enabled) {
      return;
    }
    event.preventDefault();
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [enabled]);

  const onHandlePointerMove = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) {
      return;
    }
    applyPointerRatio(event.clientY);
  }, [applyPointerRatio]);

  const onHandlePointerUp = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) {
      return;
    }
    draggingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }, []);

  const nudgeRatio = useCallback((delta: number) => {
    persistRatio(ratio + delta);
  }, [persistRatio, ratio]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        nudgeRatio(-0.04);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        nudgeRatio(0.04);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, nudgeRatio]);

  const codeFlex = enabled ? `${(ratio * 100).toFixed(2)}%` : undefined;
  const previewFlex = enabled ? `${((1 - ratio) * 100).toFixed(2)}%` : undefined;

  return {
    containerRef,
    ratio,
    enabled,
    codeFlex,
    previewFlex,
    onHandlePointerDown,
    onHandlePointerMove,
    onHandlePointerUp,
    nudgeRatio,
  };
}
