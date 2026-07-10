import type { RefObject } from 'react';
import { useMoaBoundedPointerDrag } from '../../hooks/useMoaBoundedPointerDrag';

/**
 * AI 생성앱 하단 툴바 — 소유자 칩 드래그로 일시 이동(저장 없음), 창 경계 내 클램프.
 * 임계값 이하 이동은 클릭(메뉴 토글)으로 처리한다.
 */
export function useGeneratedAppToolbarDrag(
  boundsRef: RefObject<HTMLElement | null>,
  toolbarRef: RefObject<HTMLElement | null>,
) {
  const {
    style: toolbarStyle,
    isDragging,
    handleClassName,
    resetPosition,
    pointerHandlers,
    shouldSuppressClick,
  } = useMoaBoundedPointerDrag({
    boundsRef,
    targetRef: toolbarRef,
  });

  return {
    toolbarStyle,
    isDragging,
    handleClassName,
    resetPosition,
    ownerPointerHandlers: pointerHandlers,
    shouldSuppressOwnerClick: shouldSuppressClick,
  };
}
