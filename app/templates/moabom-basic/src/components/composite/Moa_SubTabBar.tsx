import React from 'react';
import { Div } from '../basic/Div';
import { Button } from '../basic/Button';

export interface SubTabBarTab {
  id: string;
  label: string;
  /** 탭 라벨 우측 배지 (미읽음 수 등) */
  badge?: number;
}

export interface SubTabBarProps {
  /** 탭 목록 */
  tabs: SubTabBarTab[];
  /** 현재 활성 탭 ID */
  activeTab: string;
  /** 탭 변경 핸들러 (동일 탭 재클릭도 호출 — 부모에서 갱신 처리) */
  onTabChange: (tabId: string) => void;
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * SubTabBar 컴포넌트
 *
 * 좌측/우측 패널에서 반복되는 서브탭 UI 패턴을 통합한 컴포넌트입니다.
 * 슬라이딩 인디케이터와 함께 탭 전환을 제공합니다.
 */
export const SubTabBar: React.FC<SubTabBarProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className = '',
}) => {
  const activeIndex = tabs.findIndex(t => t.id === activeTab);
  const tabCount = tabs.length;

  return (
    <Div className={`glass-sm-blur rounded-2xl p-1.5 relative ${className}`.trim()}>
      {/* 슬라이딩 인디케이터 */}
      <Div
        className="moa-point-fill absolute top-1.5 bottom-1.5 rounded-xl transition-all duration-300 ease-out"
        style={{
          left: `calc(6px + ${activeIndex} * ((100% - 12px) / ${tabCount}))`,
          width: `calc((100% - 12px) / ${tabCount})`,
        }}
      />
      {/* 탭 버튼들 */}
      <Div className={`grid relative z-10`} style={{ gridTemplateColumns: `repeat(${tabCount}, 1fr)` }}>
        {tabs.map(tab => (
          <Button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-2 rounded-xl text-sm border-0 transition-colors duration-200 relative z-10 cursor-pointer ${
              activeTab === tab.id
                ? 'text-white font-bold'
                : 'text-secondary font-bold hover:text-primary'
            }`}
          >
            <span className="inline-flex items-center justify-center gap-1">
              <span>{tab.label}</span>
              {tab.badge != null && tab.badge > 0 && (
                <span className="min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none flex items-center justify-center">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </span>
          </Button>
        ))}
      </Div>
    </Div>
  );
};
