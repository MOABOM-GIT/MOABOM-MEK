import React, { useEffect, useState } from 'react';
import { Div } from '../basic/Div';
import { Button } from '../basic/Button';
import { Icon } from '../basic/Icon';

export interface ThreeColumnLayoutProps {
  /**
   * 왼쪽 영역 너비 (Desktop)
   */
  leftWidth?: string;

  /**
   * 오른쪽 영역 너비 (Desktop)
   */
  rightWidth?: string;

  /**
   * 왼쪽 슬롯 컨텐츠
   */
  leftSlot?: React.ReactNode;

  /**
   * 가운데 슬롯 컨텐츠
   */
  centerSlot?: React.ReactNode;

  /**
   * 오른쪽 슬롯 컨텐츠
   */
  rightSlot?: React.ReactNode;

  /**
   * 왼쪽 패널 초기 열림 상태 (모바일/태블릿)
   */
  leftPanelOpen?: boolean;

  /**
   * 오른쪽 패널 초기 열림 상태 (태블릿)
   */
  rightPanelOpen?: boolean;

  /**
   * 왼쪽 패널 제목 (모바일 헤더용)
   */
  leftPanelTitle?: string;

  /**
   * 오른쪽 패널 제목 (모바일 헤더용)
   */
  rightPanelTitle?: string;

  /**
   * 사용자 정의 클래스
   */
  className?: string;

  /**
   * 인라인 스타일
   */
  style?: React.CSSProperties;
}

/**
 * ThreeColumnLayout 레이아웃 컴포넌트
 *
 * 반응형 3단 레이아웃 구조를 제공하는 layout 컴포넌트입니다.
 * 
 * **반응형 동작:**
 * - Desktop (lg 이상): 3개 패널 모두 표시
 * - Tablet (md ~ lg): 우측 패널 숨김, 토글 가능
 * - Mobile (md 미만): 좌측/우측 패널 숨김, 토글 가능
 *
 * @example
 * <ThreeColumnLayout
 *   leftWidth="280px"
 *   rightWidth="320px"
 *   leftPanelTitle="메뉴"
 *   rightPanelTitle="정보"
 *   leftSlot={<div>Left Content</div>}
 *   centerSlot={<div>Center Content</div>}
 *   rightSlot={<div>Right Content</div>}
 * />
 */
export const ThreeColumnLayout: React.FC<ThreeColumnLayoutProps> = ({
  leftWidth = '280px',
  rightWidth = '320px',
  leftSlot,
  centerSlot,
  rightSlot,
  leftPanelOpen = false,
  rightPanelOpen = false,
  leftPanelTitle = 'Menu',
  rightPanelTitle = 'Info',
  className = '',
  style,
}) => {
  // 패널 열림/닫힘 상태
  const [isLeftOpen, setIsLeftOpen] = useState(leftPanelOpen);
  const [isRightOpen, setIsRightOpen] = useState(rightPanelOpen);

  // 화면 크기 감지
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setScreenSize('mobile');
      } else if (width < 1024) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 패널 토글 핸들러
  const toggleLeftPanel = () => setIsLeftOpen(!isLeftOpen);
  const toggleRightPanel = () => setIsRightOpen(!isRightOpen);

  // 오버레이 클릭 시 패널 닫기
  const closeLeftPanel = () => setIsLeftOpen(false);
  const closeRightPanel = () => setIsRightOpen(false);

  // 컨테이너 클래스
  const containerClasses = `relative flex flex-row w-full h-full ${className}`.trim();

  // 왼쪽 패널 표시 여부
  const showLeftPanel = screenSize === 'desktop' || isLeftOpen;
  const leftPanelFixed = screenSize !== 'desktop';

  // 오른쪽 패널 표시 여부
  const showRightPanel = screenSize === 'desktop' || (screenSize === 'tablet' && isRightOpen) || (screenSize === 'mobile' && isRightOpen);
  const rightPanelFixed = screenSize !== 'desktop';

  return (
    <Div className={containerClasses} style={style}>
      {/* 왼쪽 패널 토글 버튼 (모바일/태블릿) */}
      {screenSize !== 'desktop' && (
        <Div className="fixed top-4 left-4 z-50">
          <Button
            variant="primary"
            size="sm"
            onClick={toggleLeftPanel}
            className="shadow-lg"
          >
            <Icon name={isLeftOpen ? 'times' : 'bars'} className="text-white" />
          </Button>
        </Div>
      )}

      {/* 오른쪽 패널 토글 버튼 (모바일/태블릿) */}
      {screenSize !== 'desktop' && (
        <Div className="fixed top-4 right-4 z-50">
          <Button
            variant="primary"
            size="sm"
            onClick={toggleRightPanel}
            className="shadow-lg"
          >
            <Icon name={isRightOpen ? 'times' : 'info-circle'} className="text-white" />
          </Button>
        </Div>
      )}

      {/* 왼쪽 패널 오버레이 (모바일/태블릿에서 열렸을 때) */}
      {leftPanelFixed && isLeftOpen && (
        <Div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={closeLeftPanel}
        />
      )}

      {/* 왼쪽 패널 */}
      {showLeftPanel && (
        <Div
          className={`
            flex flex-col bg-white border-r border-gray-200
            ${leftPanelFixed ? 'fixed top-0 left-0 h-full z-50 shadow-xl' : 'relative'}
            transition-transform duration-300 ease-in-out
          `.trim()}
          style={{
            width: leftWidth,
            transform: leftPanelFixed && !isLeftOpen ? 'translateX(-100%)' : 'translateX(0)',
          }}
        >
          {/* 패널 헤더 (모바일/태블릿) */}
          {leftPanelFixed && (
            <Div className="flex items-center justify-between p-4 border-b border-gray-200">
              <Div className="text-lg font-bold text-gray-900">{leftPanelTitle}</Div>
              <Button
                variant="secondary"
                size="sm"
                onClick={closeLeftPanel}
              >
                <Icon name="times" className="text-gray-600" />
              </Button>
            </Div>
          )}
          
          {/* 패널 콘텐츠 */}
          <Div className="flex-1 overflow-y-auto">
            {leftSlot}
          </Div>
        </Div>
      )}

      {/* 가운데 패널 */}
      <Div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {centerSlot}
      </Div>

      {/* 오른쪽 패널 오버레이 (모바일/태블릿에서 열렸을 때) */}
      {rightPanelFixed && isRightOpen && (
        <Div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={closeRightPanel}
        />
      )}

      {/* 오른쪽 패널 */}
      {showRightPanel && (
        <Div
          className={`
            flex flex-col bg-white border-l border-gray-200
            ${rightPanelFixed ? 'fixed top-0 right-0 h-full z-50 shadow-xl' : 'relative'}
            transition-transform duration-300 ease-in-out
          `.trim()}
          style={{
            width: rightWidth,
            transform: rightPanelFixed && !isRightOpen ? 'translateX(100%)' : 'translateX(0)',
          }}
        >
          {/* 패널 헤더 (모바일/태블릿) */}
          {rightPanelFixed && (
            <Div className="flex items-center justify-between p-4 border-b border-gray-200">
              <Div className="text-lg font-bold text-gray-900">{rightPanelTitle}</Div>
              <Button
                variant="secondary"
                size="sm"
                onClick={closeRightPanel}
              >
                <Icon name="times" className="text-gray-600" />
              </Button>
            </Div>
          )}
          
          {/* 패널 콘텐츠 */}
          <Div className="flex-1 overflow-y-auto">
            {rightSlot}
          </Div>
        </Div>
      )}
    </Div>
  );
};
