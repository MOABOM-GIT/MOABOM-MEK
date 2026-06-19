import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Div } from '../basic/Div';
import {
  MOA_G7_WINDOW_HOST_CLASS,
  adaptG7LayoutTreeForContainerWidth,
  type G7LayoutNode,
} from '../../shell/g7WindowContainerResponsive';

export interface MoaG7ContainerHostProps<T extends G7LayoutNode> {
  className?: string;
  /** 호스트 루트 data-testid (예: moa-board-window-host) */
  hostTestId?: string;
  /** G7 layout `components` / content 슬롯 루트 (변환 전) */
  layoutRoots: T[];
  children: (adaptedRoots: T[], containerWidth: number) => React.ReactNode;
}

/**
 * G7 DynamicRenderer 등을 감싸는 공통 윈도우 본문 호스트.
 * ResizeObserver로 컨테이너 폭을 측정해 JSON 반응형·Tailwind breakpoint를 창 폭 기준으로 맞춘다.
 */
export function MoaG7ContainerHost<T extends G7LayoutNode>({
  className = '',
  hostTestId = 'moa-g7-window-host',
  layoutRoots,
  children,
}: MoaG7ContainerHostProps<T>): React.ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1024);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) {
      return;
    }

    const measure = () => {
      const width = el.clientWidth;
      if (width > 0) {
        setContainerWidth(width);
      }
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const adaptedRoots = useMemo(
    () => adaptG7LayoutTreeForContainerWidth(layoutRoots, containerWidth),
    [layoutRoots, containerWidth],
  );

  return (
    <Div
      ref={hostRef}
      data-testid={hostTestId}
      className={`${MOA_G7_WINDOW_HOST_CLASS} min-h-0 min-w-0 flex-1 ${className}`.trim()}
    >
      {children(adaptedRoots, containerWidth)}
    </Div>
  );
}
