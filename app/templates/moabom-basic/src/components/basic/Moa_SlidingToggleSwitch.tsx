import React from 'react';
import { Button } from './Button';
import { Span } from './Span';
import { Icon } from './Icon';

export interface SlidingToggleSwitchProps {
  /**
   * 스위치 on 여부(슬라이더·포인트 색).
   * 패널 토글 등에서 `true` = 패널이 열린 상태.
   */
  checked: boolean;
  onCheckedChange: () => void;
  /** 슬라이더 원 안 Font Awesome 아이콘 이름(`Icon`과 동일 계약) */
  icon?: string;
  compact?: boolean;
  /** `checked === true`일 때 접근 가능한 이름(예: 패널 닫기) */
  ariaLabelWhenOn: string;
  /** `checked === false`일 때 접근 가능한 이름(예: 패널 열기) */
  ariaLabelWhenOff: string;
  className?: string;
}

/**
 * 슬라이딩 아이콘 스위치
 *
 * `role="switch"` + `aria-checked` — 아이콘·레이블은 호출부(i18n)에서 공급합니다.
 * 트랙 배경은 `moa-home/07-sliding-toggle.css`의 `.moa-sliding-toggle--off`로 라이트/다크 대비를 맞춥니다.
 */
export const SlidingToggleSwitch: React.FC<SlidingToggleSwitchProps> = ({
  checked,
  onCheckedChange,
  icon = 'bars',
  compact = false,
  ariaLabelWhenOn,
  ariaLabelWhenOff,
  className = '',
}) => {
  /*
   * 슬라이더 이동량은 rem(Tailwind translate-x-*)로 맞춘다.
   * 고정 px(20px)는 html font-size 스케일 시 트랙(w-12=3rem)과 어긋나 썸이 튀어나간다.
   */
  const thumbShiftClass = compact ? 'translate-x-[1.0625rem]' : 'translate-x-5';

  return (
    <Button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? ariaLabelWhenOn : ariaLabelWhenOff}
      onClick={onCheckedChange}
      className={`moa-sliding-toggle relative shrink-0 border-0 cursor-pointer transition-all duration-300 ease-out p-0 ${
        compact ? 'w-10 h-[23px] rounded-[18px]' : 'w-12 h-7 rounded-[20px]'
      } ${checked ? 'moa-sliding-toggle--on' : 'moa-sliding-toggle--off'} ${className}`.trim()}
    >
      <Span
        className={`absolute top-0.5 left-0.5 rounded-full bg-white dark:bg-slate-100 flex items-center justify-center transition-transform duration-300 shadow-sm ${
          compact ? 'w-[19px] h-[19px]' : 'w-6 h-6'
        } ${checked ? thumbShiftClass : 'translate-x-0'}`}
      >
        <Icon
          name={icon}
          size={compact ? 'xxs' : undefined}
          className={`${compact ? '' : 'text-xs'} ${
            checked ? 'text-[var(--moa-point-color)]' : 'text-slate-500 dark:text-slate-400'
          }`.trim()}
        />
      </Span>
    </Button>
  );
};
