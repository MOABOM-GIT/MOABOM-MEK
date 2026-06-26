import { useEffect, useRef } from 'react';
import { isMoabomBootPhaseAtLeast, whenMoabomBootPhaseAtLeast } from '../runtime/moabomShellBootPipeline';

interface UseMoabomServerPullTriggersOptions {
  enabled?: boolean;
  debounceMs: number;
  onFocus?: boolean;
  onVisible?: boolean;
}

/**
 * visibility/focus 재동기화 트리거를 공통화한다.
 * - 같은 시점에 여러 이벤트가 와도 pull은 직렬화한다.
 * - 진행 중 추가 이벤트는 1회 재실행으로 압축한다.
 */
export function useMoabomServerPullTriggers(
  pull: () => Promise<void>,
  {
    enabled = true,
    debounceMs,
    onFocus = true,
    onVisible = true,
  }: UseMoabomServerPullTriggersOptions,
): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inFlightRef = useRef(false);
  const rerunRequestedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const runPull = async () => {
      if (inFlightRef.current) {
        rerunRequestedRef.current = true;
        return;
      }

      inFlightRef.current = true;
      try {
        do {
          rerunRequestedRef.current = false;
          await pull();
        } while (rerunRequestedRef.current);
      } finally {
        inFlightRef.current = false;
      }
    };

    const schedulePull = () => {
      const runScheduled = () => {
        if (timeoutRef.current !== undefined) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          void runPull();
        }, debounceMs);
      };

      if (isMoabomBootPhaseAtLeast('secondary')) {
        runScheduled();
        return;
      }

      whenMoabomBootPhaseAtLeast('secondary', runScheduled);
    };

    const onVisibilityChange = () => {
      if (!onVisible) {
        return;
      }
      if (document.visibilityState !== 'visible') {
        return;
      }
      schedulePull();
    };

    const onWindowFocus = () => {
      if (!onFocus) {
        return;
      }
      schedulePull();
    };

    if (onVisible) {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    if (onFocus) {
      window.addEventListener('focus', onWindowFocus);
    }

    return () => {
      if (onVisible) {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      if (onFocus) {
        window.removeEventListener('focus', onWindowFocus);
      }
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, debounceMs, onFocus, onVisible, pull]);
}
