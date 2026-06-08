import React from 'react';
import { Div } from '../basic/Div';
import { Icon } from '../basic/Icon';
import { Moa_OverflowMarqueeText } from './Moa_OverflowMarqueeText';

export interface AppCardProps {
  /**
   * 앱 ID
   */
  id?: string | number;

  /**
   * 앱 이름
   */
  name: string;

  /**
   * 앱 설명
   */
  description?: string;

  /**
   * 앱 아이콘 (FontAwesome 아이콘명 또는 이미지 URL)
   */
  icon?: string;

  /**
   * 아이콘 타입 (icon | image)
   */
  iconType?: 'icon' | 'image';

  /**
   * 앱 배경색 (Tailwind 색상 클래스)
   */
  bgColor?: string;

  /**
   * 앱 아이콘 색상
   */
  iconColor?: string;

  /**
   * 설치 여부
   */
  installed?: boolean;

  /**
   * 클릭 핸들러
   */
  onClick?: () => void;

  /**
   * 사용자 정의 클래스
   */
  className?: string;
}

/**
 * AppCard 컴포넌트
 *
 * MOABOM 앱 스토어의 앱 카드 컴포넌트입니다.
 * 둥근 아이콘, 앱 이름, 설명을 표시합니다.
 *
 * @example
 * <AppCard
 *   name="날씨"
 *   description="실시간 날씨 정보"
 *   icon="cloud-sun"
 *   bgColor="bg-blue-500"
 *   iconColor="text-white"
 * />
 */
export const AppCard: React.FC<AppCardProps> = ({
  id,
  name,
  description,
  icon = 'cube',
  iconType = 'icon',
  bgColor = 'bg-gradient-to-br from-blue-400 to-blue-600',
  iconColor = 'text-white',
  installed = false,
  onClick,
  className = '',
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <Div
      data-app-id={id}
      className={`
        flex flex-col items-center p-4 rounded-2xl
        hover:bg-gray-50 dark:hover:bg-slate-800/55 transition-all duration-200
        cursor-pointer group
        ${className}
      `.trim()}
      onClick={handleClick}
    >
      {/* 앱 아이콘 */}
      <Div
        className={`
          relative w-16 h-16 rounded-2xl flex items-center justify-center
          shadow-lg group-hover:shadow-xl transition-shadow duration-200
          ${bgColor}
        `.trim()}
      >
        {iconType === 'icon' ? (
          <Icon
            name={icon}
            className={`text-3xl ${iconColor}`}
          />
        ) : (
          <img
            src={icon}
            alt={name}
            className="w-12 h-12 object-contain"
          />
        )}

        {/* 설치됨 배지 */}
        {installed && (
          <Div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
            <Icon name="check" className="text-white text-xs" />
          </Div>
        )}
      </Div>

      <Moa_OverflowMarqueeText
        text={name}
        className="mt-3 text-sm font-bold text-primary text-center"
      />

      {description ? (
        <Moa_OverflowMarqueeText
          text={description}
          className="mt-1 text-xs text-muted text-center"
        />
      ) : null}
    </Div>
  );
};
