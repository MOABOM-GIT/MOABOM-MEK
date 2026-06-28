import React, { useRef } from 'react';
import { Div } from '../basic/Div';
import {
  MOA_HORIZONTAL_STRIP_CLASS,
  useMoaHorizontalPointerStrip,
  type UseMoaHorizontalPointerStripOptions,
} from '../../hooks/Moa_useHorizontalPointerStrip';

export interface MoaHorizontalPointerStripProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'>,
    UseMoaHorizontalPointerStripOptions {
  children: React.ReactNode;
}

/**
 * 가로 1줄 스트립 — 태스크바·유저 활동 앱 행 등 공통 포인터 스크롤 + 탭 활성화.
 * 레이아웃(gap·padding·align)은 `className` 으로 표면별 지정.
 */
export const Moa_HorizontalPointerStrip: React.FC<MoaHorizontalPointerStripProps> = ({
  className = '',
  itemDataAttribute,
  onItemActivate,
  disabled,
  children,
  ...rest
}) => {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const pointerHandlers = useMoaHorizontalPointerStrip(stripRef, {
    itemDataAttribute,
    onItemActivate,
    disabled,
  });

  const mergedClassName = className
    ? `${MOA_HORIZONTAL_STRIP_CLASS} ${className}`
    : MOA_HORIZONTAL_STRIP_CLASS;

  return (
    <Div ref={stripRef} className={mergedClassName} {...pointerHandlers} {...rest}>
      {children}
    </Div>
  );
};
