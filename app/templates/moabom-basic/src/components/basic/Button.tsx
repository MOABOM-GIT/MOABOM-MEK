import React, { forwardRef } from 'react';

// G7Core 전역 객체의 스타일 헬퍼 접근
const G7Core = () => (window as any).G7Core;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'primary'
    | 'primary-outline'
    | 'secondary'
    | 'dark'
    | 'dark-outline'
    | 'danger'
    | 'danger-outline'
    | 'success'
    | 'success-outline'
  | 'warning'
  | 'warning-outline'
  | 'taskbar'
  /** 글래스 필(유색·그라데이션 카드 위 CTA, `moa-btn-neutral`) */
  | 'neutral'
  /** 아이콘·보조 액션 — `neutral` 과 동일 표면 */
  | 'ghost';
  size?: 'xxs' | 'xxsDuo' | 'xs' | 'sm' | 'medium' | 'md' | 'large' | 'lg' | 'xl';
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'moa-btn-primary',
  'primary-outline': 'moa-btn-primary-outline',
  secondary: 'moa-btn-dark-outline',
  dark: 'moa-btn-dark',
  'dark-outline': 'moa-btn-dark-outline',
  danger: 'moa-btn-danger',
  'danger-outline': 'moa-btn-danger-outline',
  success: 'moa-btn-success',
  'success-outline': 'moa-btn-success-outline',
  warning: 'moa-btn-warning',
  'warning-outline': 'moa-btn-warning-outline',
  taskbar: 'moa-btn-taskbar',
  neutral: 'moa-btn-neutral',
  ghost: 'moa-btn-neutral',
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  xxs: 'moa-btn-xxs',
  xxsDuo: 'moa-btn-xxs-duo',
  xs: 'moa-btn-xs',
  sm: 'moa-btn-sm',
  medium: 'moa-btn-medium',
  md: 'moa-btn-medium',
  large: 'moa-btn-large',
  lg: 'moa-btn-large',
  xl: 'moa-btn-xl',
};

/**
 * 기본 버튼 컴포넌트
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant,
  size = 'md',
  className = '',
  ...props
}, ref) => {
  const baseClasses = variant
    ? `moa-btn ${VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.neutral} ${SIZE_CLASSES[size] ?? SIZE_CLASSES.md}`
    : 'inline-flex items-center justify-center';

  // G7Core.style.mergeClasses를 사용하여 충돌하는 Tailwind 클래스 병합
  const mergedClassName = G7Core()?.style?.mergeClasses?.(baseClasses, className)
    ?? `${baseClasses} ${className}`;

  return (
    <button
      ref={ref}
      className={mergedClassName}
      {...props}
    >
      {children}
    </button>
  );
});

Button.displayName = 'Button';
