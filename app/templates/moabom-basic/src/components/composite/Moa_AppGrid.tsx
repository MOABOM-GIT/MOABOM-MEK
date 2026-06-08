import React from 'react';
import { Div } from '../basic/Div';
import { H2 } from '../basic/H2';
import { P } from '../basic/P';

export interface AppGridProps {
  /**
   * 그리드 제목
   */
  title?: string;

  /**
   * 그리드 설명
   */
  description?: string;

  /**
   * 열 개수 (반응형)
   */
  cols?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };

  /**
   * 간격 (px)
   */
  gap?: number;

  /**
   * 자식 요소 (AppCard 컴포넌트들)
   */
  children?: React.ReactNode;

  /**
   * 사용자 정의 클래스
   */
  className?: string;
}

/**
 * AppGrid 컴포넌트
 *
 * 앱 카드들을 그리드 형태로 배치하는 레이아웃 컴포넌트입니다.
 * 동적 열 개수는 인라인 스타일로 처리하여 Tailwind safelist 문제를 회피합니다.
 *
 * @example
 * <AppGrid
 *   title="추천 앱"
 *   description="인기 있는 앱들을 만나보세요"
 *   cols={{ mobile: 2, tablet: 3, desktop: 4 }}
 * >
 *   <AppCard name="날씨" icon="cloud-sun" />
 *   <AppCard name="음악" icon="music" />
 * </AppGrid>
 */
export const AppGrid: React.FC<AppGridProps> = ({
  title,
  description,
  cols = { mobile: 2, tablet: 3, desktop: 4 },
  gap = 16,
  children,
  className = '',
}) => {
  // 동적 열 개수는 CSS 변수로 전달하여 Tailwind 동적 클래스 문제 회피
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols.desktop || 4}, 1fr)`,
    gap: `${gap}px`,
  };

  return (
    <Div className={`w-full ${className}`.trim()}>
      {/* 헤더 */}
      {(title || description) && (
        <Div className="mb-6">
          {title && (
            <H2 className="text-2xl font-bold text-heading mb-2">
              {title}
            </H2>
          )}
          {description && (
            <P className="text-muted">
              {description}
            </P>
          )}
        </Div>
      )}

      {/* 그리드 - 인라인 스타일로 동적 열 개수 처리 */}
      <Div style={gridStyle}>
        {children}
      </Div>
    </Div>
  );
};
