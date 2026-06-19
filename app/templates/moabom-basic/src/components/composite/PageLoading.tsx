import React from 'react';
import AppLoadingSpinner from './AppLoadingSpinner';

/**
 * 페이지 로딩 컴포넌트 Props (엔진에서 전달)
 *
 * @since engine-v1.29.0
 */
export interface PageLoadingProps {
    options?: {
        text?: string;
    };
}

// G7Core.t() 번역 함수 참조
const t = (key: string, params?: Record<string, string | number>) =>
    (window as any).G7Core?.t?.(key, params) ?? key;

/**
 * 페이지 로딩 인디케이터 컴포넌트
 *
 * transition_overlay의 spinner 스타일에서 사용됩니다.
 * 엔진은 타겟 요소 내부에 빈 컨테이너만 삽입하며,
 * 포지셔닝/배경/z-index/다크모드 등 모든 비주얼 스타일은
 * 이 컴포넌트가 전적으로 결정합니다.
 *
 * React 트리 외부에 렌더링되므로 인라인 스타일 사용.
 *
 * @since engine-v1.29.0
 */
const PageLoading: React.FC<PageLoadingProps> = ({ options }) => {
    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                zIndex: 2147483647,
                overflow: 'hidden',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
            }}
        >
            <AppLoadingSpinner label={options?.text || t('nav.loading')} />
        </div>
    );
};

export default PageLoading;
