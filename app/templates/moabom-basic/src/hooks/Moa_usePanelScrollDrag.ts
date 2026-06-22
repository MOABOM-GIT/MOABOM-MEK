import { useCallback, useRef, type RefObject } from 'react';

const INTERACTIVE_SELECTOR = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  'label',
  '[role="button"]',
  '[contenteditable="true"]',
  '[data-panel-no-scroll-drag]',
].join(',');

const DRAG_THRESHOLD_PX = 4;

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(target.closest(INTERACTIVE_SELECTOR));
}

export interface UseMoaPanelScrollDragOptions {
  /** true면 커스텀 드래그 스크롤 비활성(편집 모드 등) */
  disabled?: boolean;
}

/**
 * 좌·우 패널 스크롤 영역용 포인터 드래그 스크롤.
 * - 터치: 네이티브 overflow 스크롤만 사용(포인터 캡처 없음)
 * - 마우스: 비인터랙티브 영역에서만 임계값 이후 드래그 스크롤
 * - 버튼·링크 등 인터랙티브 자식 클릭은 유지
 */
export function useMoaPanelScrollDrag(
  scrollRef: RefObject<HTMLDivElement | null>,
  options: UseMoaPanelScrollDragOptions = {},
) {
  const dragRef = useRef({
    active: false,
    moved: false,
    startY: 0,
    scrollTop: 0,
    pointerId: -1,
  });

  const endDrag = useCallback((el: HTMLDivElement | null, pointerId: number, preventDefault: boolean) => {
    const drag = dragRef.current;
    if (el?.hasPointerCapture(pointerId)) {
      el.releasePointerCapture(pointerId);
    }
    el?.classList.remove('is-panel-scroll-dragging');

    if (preventDefault && drag.moved) {
      // noop — caller may preventDefault on event
    }

    drag.active = false;
    drag.moved = false;
    drag.pointerId = -1;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (options.disabled) {
      return;
    }
    if (e.pointerType !== 'mouse') {
      return;
    }
    if (e.button !== 0) {
      return;
    }
    if (isInteractiveTarget(e.target)) {
      return;
    }

    const el = scrollRef.current;
    if (!el) {
      return;
    }

    dragRef.current = {
      active: true,
      moved: false,
      startY: e.clientY,
      scrollTop: el.scrollTop,
      pointerId: e.pointerId,
    };
  }, [options.disabled, scrollRef]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    const drag = dragRef.current;
    if (!el || !drag.active || e.pointerId !== drag.pointerId) {
      return;
    }

    const deltaY = e.clientY - drag.startY;
    if (!drag.moved && Math.abs(deltaY) > DRAG_THRESHOLD_PX) {
      drag.moved = true;
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-panel-scroll-dragging');
    }

    if (drag.moved) {
      el.scrollTop = drag.scrollTop - deltaY;
      e.preventDefault();
    }
  }, [scrollRef]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    const drag = dragRef.current;
    if (!drag.active || e.pointerId !== drag.pointerId) {
      return;
    }

    if (drag.moved) {
      e.preventDefault();
    }
    endDrag(el, e.pointerId, drag.moved);
  }, [endDrag, scrollRef]);

  const onPointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    const drag = dragRef.current;
    if (!drag.active || e.pointerId !== drag.pointerId) {
      return;
    }
    endDrag(el, e.pointerId, false);
  }, [endDrag, scrollRef]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
