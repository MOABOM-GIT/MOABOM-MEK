import { useCallback, useRef, type RefObject } from 'react';

const DRAG_THRESHOLD_PX = 4;

/** 가로 포인터 스트립 공통 루트 클래스 */
export const MOA_HORIZONTAL_STRIP_CLASS = 'moa-horizontal-strip';

/** 태스크바 최소화 버튼 식별 속성 */
export const MOA_TASKBAR_WINDOW_ID_ATTR = 'data-taskbar-window-id';

/** 유저 활동 앱 스트립 아이템 식별 속성 */
export const MOA_USER_PROFILE_APP_ID_ATTR = 'data-user-profile-app-id';

export interface UseMoaHorizontalPointerStripOptions {
  /** 아이템 식별 data 속성명 (예: `data-user-profile-app-id`) */
  itemDataAttribute?: string;
  onItemActivate?: (itemId: string) => void;
  disabled?: boolean;
}

/**
 * 메인 패널 태스크바와 동일한 포인터 모델 — 드래그 시 스크롤, 짧은 탭만 활성화.
 * 터치는 `touch-action: pan-x` 네이티브 가로 스크롤, 마우스·펜은 드래그 스크롤.
 */
export function useMoaHorizontalPointerStrip(
  scrollRef: RefObject<HTMLDivElement | null>,
  options: UseMoaHorizontalPointerStripOptions = {},
) {
  const itemDataAttribute = options.itemDataAttribute ?? 'data-strip-item-id';
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    scrollLeft: 0,
    itemId: '',
  });

  const resolveItemId = useCallback((target: EventTarget | null): string => {
    if (!(target instanceof Element)) {
      return '';
    }
    const item = target.closest<HTMLElement>(`[${itemDataAttribute}]`);
    return item?.getAttribute(itemDataAttribute)?.trim() ?? '';
  }, [itemDataAttribute]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (options.disabled) {
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) {
      return;
    }

    const strip = scrollRef.current;
    if (!strip) {
      return;
    }

    strip.setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      scrollLeft: strip.scrollLeft,
      itemId: resolveItemId(e.target),
    };
  }, [options.disabled, resolveItemId, scrollRef]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const strip = scrollRef.current;
    const drag = dragRef.current;
    if (!strip || !drag.active) {
      return;
    }

    const deltaX = e.clientX - drag.startX;
    if (Math.abs(deltaX) > DRAG_THRESHOLD_PX) {
      drag.moved = true;
    }

    if (drag.moved) {
      strip.scrollLeft = drag.scrollLeft - deltaX;
      e.preventDefault();
    }
  }, [scrollRef]);

  const onPointerEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const strip = scrollRef.current;
    const drag = dragRef.current;

    if (strip?.hasPointerCapture(e.pointerId)) {
      strip.releasePointerCapture(e.pointerId);
    }

    dragRef.current.active = false;

    if (drag.moved) {
      dragRef.current.moved = false;
      dragRef.current.itemId = '';
      return;
    }

    if (drag.itemId) {
      options.onItemActivate?.(drag.itemId);
    }

    dragRef.current.moved = false;
    dragRef.current.itemId = '';
  }, [options, scrollRef]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
  };
}
