import React from 'react';
import { Div } from '../basic/Div';

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 패널 위치/크기 스타일 */
  style?: React.CSSProperties;
  /** 추가 CSS 클래스 */
  className?: string;
  /** 패널 내부 콘텐츠 클래스 */
  contentClassName?: string;
  /** 자식 요소 */
  children?: React.ReactNode;
}

/**
 * GlassPanel 컴포넌트
 *
 * 좌측/중앙/우측 패널에서 공통으로 사용하는 CSS 기반 글래스 래퍼입니다.
 */
export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(({
  style,
  className = '',
  contentClassName = 'flex flex-col h-full w-full p-2 overflow-hidden',
  children,
  ...rest
}, ref) => {
  return (
    <Div ref={ref} className={`panel-slide glass-panel ${className}`.trim()} style={style} {...rest}>
      <Div className={contentClassName}>
        {children}
      </Div>
    </Div>
  );
});

GlassPanel.displayName = 'GlassPanel';
