import React from 'react';

const SPIN_KEYFRAMES = '@keyframes moabom-loading-spin{to{transform:rotate(360deg)}}';

export interface AppLoadingSpinnerProps {
  label?: string;
  fill?: boolean;
  /** 목록·토글 옆 등 좁은 영역용 작은 스피너 */
  compact?: boolean;
  /** label을 화면에 표시하지 않고 aria-label만 설정 */
  hideLabel?: boolean;
  className?: string;
}

export const AppLoadingSpinner: React.FC<AppLoadingSpinnerProps> = ({
  label,
  fill = false,
  compact = false,
  hideLabel = false,
  className = '',
}) => {
  const spinnerSize = compact ? '1rem' : '2rem';
  const spinnerBorder = compact ? '2px' : '3px';

  const rootClassName = [
    fill ? 'min-h-[200px] w-full flex-1' : '',
    compact
      ? 'inline-flex flex-row items-center justify-center gap-2 text-xs text-muted'
      : 'flex flex-col items-center justify-center gap-3 text-sm text-muted',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={rootClassName}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label || 'Loading'}
    >
      <style>{SPIN_KEYFRAMES}</style>
      <span
        aria-hidden="true"
        className={compact ? 'shrink-0' : undefined}
        style={{
          width: spinnerSize,
          height: spinnerSize,
          borderRadius: '9999px',
          border: `${spinnerBorder} solid rgb(148 163 184 / 0.35)`,
          borderTopColor: 'rgb(var(--moa-point-rgb, 59 130 246) / 0.95)',
          animation: 'moabom-loading-spin 0.75s linear infinite',
        }}
      />
      {label && !hideLabel ? <span>{label}</span> : null}
    </div>
  );
};

export default AppLoadingSpinner;
