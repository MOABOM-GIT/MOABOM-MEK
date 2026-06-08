import { useRef, useCallback } from 'react';

/**
 * 롱프레스 감지 훅
 *
 * 마우스/터치 모두 지원하며, 500ms 롱프레스 시 콜백을 실행합니다.
 * 드래그 이동이 감지되면 롱프레스를 취소합니다.
 */
export interface UseLongPressOptions {
  /** 롱프레스 감지 시간 (ms) */
  delay?: number;
  /** 롱프레스 취소 이동 임계값 (px) */
  moveThreshold?: number;
}

export function useLongPress(
  onLongPress: () => void,
  options: UseLongPressOptions = {},
) {
  const { delay = 500, moveThreshold = 10 } = options;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(
    (x: number, y: number) => {
      clear();
      startPosRef.current = { x, y };
      longPressTriggeredRef.current = false;

      timerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true;
        onLongPress();
      }, delay);
    },
    [onLongPress, delay, clear],
  );

  const move = useCallback(
    (x: number, y: number) => {
      if (!startPosRef.current) return;
      const dx = Math.abs(x - startPosRef.current.x);
      const dy = Math.abs(y - startPosRef.current.y);
      if (dx > moveThreshold || dy > moveThreshold) {
        clear();
      }
    },
    [moveThreshold, clear],
  );

  const end = useCallback(() => {
    clear();
    startPosRef.current = null;
  }, [clear]);

  /** 롱프레스가 트리거되었는지 여부 (클릭 방지용) */
  const wasLongPress = useCallback(() => longPressTriggeredRef.current, []);

  const handlers = {
    onMouseDown: (e: React.MouseEvent) => start(e.clientX, e.clientY),
    onMouseMove: (e: React.MouseEvent) => move(e.clientX, e.clientY),
    onMouseUp: end,
    onMouseLeave: end,
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      start(touch.clientX, touch.clientY);
    },
    onTouchMove: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      move(touch.clientX, touch.clientY);
    },
    onTouchEnd: end,
    onTouchCancel: end,
  };

  return { handlers, wasLongPress };
}
