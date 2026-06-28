import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';

const DRAG_THRESHOLD_PX = 6;

type ToolbarOffset = { left: number; top: number };

type DragState = {
  active: boolean;
  moved: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  originLeft: number;
  originTop: number;
};

function readToolbarOffset(
  boundsEl: HTMLElement,
  toolbarEl: HTMLElement,
): ToolbarOffset {
  const boundsRect = boundsEl.getBoundingClientRect();
  const toolbarRect = toolbarEl.getBoundingClientRect();
  return {
    left: toolbarRect.left - boundsRect.left,
    top: toolbarRect.top - boundsRect.top,
  };
}

function clampToolbarOffset(
  boundsEl: HTMLElement,
  toolbarEl: HTMLElement,
  left: number,
  top: number,
): ToolbarOffset {
  const maxLeft = Math.max(0, boundsEl.clientWidth - toolbarEl.offsetWidth);
  const maxTop = Math.max(0, boundsEl.clientHeight - toolbarEl.offsetHeight);
  return {
    left: Math.min(Math.max(0, left), maxLeft),
    top: Math.min(Math.max(0, top), maxTop),
  };
}

/**
 * AI 생성앱 하단 툴바 — 소유자 칩 드래그로 일시 이동(저장 없음), 창 경계 내 클램프.
 * 임계값 이하 이동은 클릭(메뉴 토글)으로 처리한다.
 */
export function useGeneratedAppToolbarDrag(
  boundsRef: RefObject<HTMLElement | null>,
  toolbarRef: RefObject<HTMLElement | null>,
) {
  const [position, setPosition] = useState<ToolbarOffset | null>(null);
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

  const readCurrentOffset = useCallback((): ToolbarOffset => {
    const boundsEl = boundsRef.current;
    const toolbarEl = toolbarRef.current;
    if (!boundsEl || !toolbarEl) {
      return { left: 0, top: 0 };
    }
    return readToolbarOffset(boundsEl, toolbarEl);
  }, [boundsRef, toolbarRef]);

  const clampOffset = useCallback((left: number, top: number): ToolbarOffset => {
    const boundsEl = boundsRef.current;
    const toolbarEl = toolbarRef.current;
    if (!boundsEl || !toolbarEl) {
      return { left, top };
    }
    return clampToolbarOffset(boundsEl, toolbarEl, left, top);
  }, [boundsRef, toolbarRef]);

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
    if (!position) {
      return;
    }

    const boundsEl = boundsRef.current;
    if (!boundsEl) {
      return;
    }

    const reclamp = () => {
      setPosition(prev => (prev ? clampOffset(prev.left, prev.top) : prev));
    };

    const observer = new ResizeObserver(reclamp);
    observer.observe(boundsEl);
    return () => observer.disconnect();
  }, [boundsRef, clampOffset, position]);

  const onOwnerPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) {
      return;
    }

    const toolbarEl = toolbarRef.current;
    if (!toolbarEl) {
      return;
    }

    const current = position ?? readCurrentOffset();
    dragStateRef.current = {
      active: true,
      moved: false,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originLeft: current.left,
      originTop: current.top,
    };
  }, [position, readCurrentOffset, toolbarRef]);

  const onOwnerPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const state = dragStateRef.current;
    if (!state.active || e.pointerId !== state.pointerId) {
      return;
    }

    const deltaX = e.clientX - state.startX;
    const deltaY = e.clientY - state.startY;

    if (!state.moved) {
      if (Math.abs(deltaX) <= DRAG_THRESHOLD_PX && Math.abs(deltaY) <= DRAG_THRESHOLD_PX) {
        return;
      }
      state.moved = true;
      suppressNextClickRef.current = true;
      setIsDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    const next = clampOffset(
      state.originLeft + deltaX,
      state.originTop + deltaY,
    );
    setPosition(next);
    e.preventDefault();
  }, [clampOffset]);

  const endOwnerPointer = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
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

  const shouldSuppressOwnerClick = useCallback(() => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return true;
    }
    return false;
  }, []);

  const toolbarStyle: CSSProperties | undefined = position
    ? {
        left: `${position.left}px`,
        top: `${position.top}px`,
        bottom: 'auto',
        right: 'auto',
      }
    : undefined;

  return {
    toolbarStyle,
    isDragging,
    resetPosition,
    ownerPointerHandlers: {
      onPointerDown: onOwnerPointerDown,
      onPointerMove: onOwnerPointerMove,
      onPointerUp: endOwnerPointer,
      onPointerCancel: endOwnerPointer,
    },
    shouldSuppressOwnerClick,
  };
}
