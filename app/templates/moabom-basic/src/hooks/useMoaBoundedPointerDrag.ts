import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

export const MOA_POINTER_DRAG_THRESHOLD_PX = 6;

export const MOA_POINTER_DRAGGABLE_CLASS = 'moa-pointer-draggable';

export type MoaPointerOffset = { left: number; top: number };

type DragState = {
  active: boolean;
  moved: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  originLeft: number;
  originTop: number;
};

export type MoaBoundedPointerDragHandlers = {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
};

export type UseMoaBoundedPointerDragOptions = {
  /** 이동 대상(절대 위치 요소). 미지정 시 pointer 이벤트의 currentTarget 기준 offsetParent 사용. */
  targetRef?: RefObject<HTMLElement | null>;
  /** 클램프 경계. 미지정 시 target.offsetParent. */
  boundsRef?: RefObject<HTMLElement | null>;
  /** 이 값 이하 이동은 클릭으로 처리. */
  thresholdPx?: number;
  enabled?: boolean;
};

function resolveBoundsEl(
  boundsRef: RefObject<HTMLElement | null> | undefined,
  targetEl: HTMLElement | null,
): HTMLElement | null {
  return boundsRef?.current ?? (targetEl?.offsetParent as HTMLElement | null) ?? null;
}

function resolveTargetEl(
  targetRef: RefObject<HTMLElement | null> | undefined,
  eventTarget: HTMLElement,
): HTMLElement {
  return targetRef?.current ?? eventTarget;
}

function readOffset(boundsEl: HTMLElement, targetEl: HTMLElement): MoaPointerOffset {
  const boundsRect = boundsEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  return {
    left: targetRect.left - boundsRect.left,
    top: targetRect.top - boundsRect.top,
  };
}

function clampOffset(
  boundsEl: HTMLElement,
  targetEl: HTMLElement,
  left: number,
  top: number,
): MoaPointerOffset {
  const maxLeft = Math.max(0, boundsEl.clientWidth - targetEl.offsetWidth);
  const maxTop = Math.max(0, boundsEl.clientHeight - targetEl.offsetHeight);
  return {
    left: Math.min(Math.max(0, left), maxLeft),
    top: Math.min(Math.max(0, top), maxTop),
  };
}

/**
 * 경계 내 절대 위치 드래그 + 임계값 이하 이동은 클릭으로 유지.
 * liquid-glass 오버레이(앱 컨트롤·사이드 패널·요소 선택 등)에서 재사용.
 */
export function useMoaBoundedPointerDrag(
  options: UseMoaBoundedPointerDragOptions = {},
) {
  const {
    targetRef,
    boundsRef,
    thresholdPx = MOA_POINTER_DRAG_THRESHOLD_PX,
    enabled = true,
  } = options;

  const [position, setPosition] = useState<MoaPointerOffset | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<DragState>({
    active: false,
    moved: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    originLeft: 0,
    originTop: 0,
  });
  const suppressNextClickRef = useRef(false);
  const targetElRef = useRef<HTMLElement | null>(null);

  const resetPosition = useCallback(() => {
    setPosition(null);
    suppressNextClickRef.current = false;
    dragStateRef.current = {
      active: false,
      moved: false,
      pointerId: -1,
      startX: 0,
      startY: 0,
      originLeft: 0,
      originTop: 0,
    };
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      resetPosition();
    }
  }, [enabled, resetPosition]);

  useEffect(() => {
    if (!position) {
      return;
    }

    const targetEl = targetRef?.current ?? targetElRef.current;
    const boundsEl = resolveBoundsEl(boundsRef, targetEl);
    if (!boundsEl) {
      return;
    }

    const reclamp = () => {
      const liveTarget = targetRef?.current ?? targetElRef.current;
      if (!liveTarget) {
        return;
      }
      setPosition(prev => (prev ? clampOffset(boundsEl, liveTarget, prev.left, prev.top) : prev));
    };

    const observer = new ResizeObserver(reclamp);
    observer.observe(boundsEl);
    return () => observer.disconnect();
  }, [boundsRef, position, targetRef]);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (!enabled) {
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) {
      return;
    }

    const targetEl = resolveTargetEl(targetRef, e.currentTarget);
    const boundsEl = resolveBoundsEl(boundsRef, targetEl);
    if (!boundsEl) {
      return;
    }

    targetElRef.current = targetEl;
    const current = position ?? readOffset(boundsEl, targetEl);
    dragStateRef.current = {
      active: true,
      moved: false,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originLeft: current.left,
      originTop: current.top,
    };
  }, [boundsRef, enabled, position, targetRef]);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const state = dragStateRef.current;
    if (!state.active || e.pointerId !== state.pointerId) {
      return;
    }

    const targetEl = resolveTargetEl(targetRef, e.currentTarget);
    const boundsEl = resolveBoundsEl(boundsRef, targetEl);
    if (!boundsEl) {
      return;
    }

    const deltaX = e.clientX - state.startX;
    const deltaY = e.clientY - state.startY;

    if (!state.moved) {
      if (Math.abs(deltaX) <= thresholdPx && Math.abs(deltaY) <= thresholdPx) {
        return;
      }
      state.moved = true;
      suppressNextClickRef.current = true;
      setIsDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    setPosition(clampOffset(
      boundsEl,
      targetEl,
      state.originLeft + deltaX,
      state.originTop + deltaY,
    ));
    e.preventDefault();
  }, [boundsRef, targetRef, thresholdPx]);

  const endPointer = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const state = dragStateRef.current;
    if (!state.active || e.pointerId !== state.pointerId) {
      return;
    }

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (state.moved) {
      e.preventDefault();
    }

    state.active = false;
    state.moved = false;
    state.pointerId = -1;
    setIsDragging(false);
  }, []);

  const shouldSuppressClick = useCallback(() => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return true;
    }
    return false;
  }, []);

  const style: CSSProperties | undefined = position
    ? {
        left: `${position.left}px`,
        top: `${position.top}px`,
        bottom: 'auto',
        right: 'auto',
      }
    : undefined;

  /** 포인터 핸들을 붙이는 요소(칩·타이틀·토글) */
  const handleClassName = moaPointerDraggableClassName(isDragging);
  /** 실제로 이동하는 절대 위치 요소 — grab 커서 없이 is-dragging 만 */
  const targetClassName = isDragging ? 'is-dragging' : '';

  const pointerHandlers: MoaBoundedPointerDragHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp: endPointer,
    onPointerCancel: endPointer,
  };

  return {
    style,
    isDragging,
    handleClassName,
    targetClassName,
    resetPosition,
    pointerHandlers,
    shouldSuppressClick,
  };
}

export function moaPointerDraggableClassName(isDragging = false): string {
  return `${MOA_POINTER_DRAGGABLE_CLASS}${isDragging ? ' is-dragging' : ''}`;
}
