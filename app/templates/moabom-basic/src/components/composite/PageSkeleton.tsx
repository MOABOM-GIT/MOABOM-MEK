import React from 'react';
import AppLoadingSpinner from './AppLoadingSpinner';

export interface PageSkeletonProps {
  components?: unknown[];
  options: {
    animation: 'pulse' | 'wave' | 'none';
    iteration_count: number;
  };
}

/**
 * Legacy skeleton overlay entrypoint.
 *
 * 레이아웃을 복제한 스켈레톤 대신, 모든 페이지 전환/웹앱 로딩에서
 * 동일한 원형 로딩 표시만 사용한다.
 */
export const PageSkeleton: React.FC<PageSkeletonProps> = () => (
  <div
    className="moa-app-window-viewport w-full min-w-0"
    role="status"
    aria-busy="true"
    aria-label="Loading..."
  >
    <AppLoadingSpinner label={(window as any).G7Core?.t?.('nav.loading') ?? 'Loading...'} fill />
  </div>
);

export default PageSkeleton;
