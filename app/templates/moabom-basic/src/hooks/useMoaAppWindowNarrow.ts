import { useCallback, useRef, useState } from 'react';
import { MOA_APP_WINDOW_CQ } from '../apps/appWindowBreakpoints';

const SM_PX = Number.parseInt(MOA_APP_WINDOW_CQ.sm, 10);

/** 창 본문(`.moa-app-window-viewport`) 폭이 sm 미만인지 감지합니다. */
export function useMoaAppWindowNarrow(): {
  narrow: boolean;
  containerRef: (node: HTMLDivElement | null) => void;
} {
  const [narrow, setNarrow] = useState(false);
  const observerRef = useRef<ResizeObserver | null>(null);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (!node) {
      return;
    }

    const root = node.closest('.moa-app-window-viewport') as HTMLElement | null;
    if (!root) {
      return;
    }

    const update = () => {
      setNarrow(root.clientWidth < SM_PX);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    observerRef.current = observer;
  }, []);

  return { narrow, containerRef };
}
