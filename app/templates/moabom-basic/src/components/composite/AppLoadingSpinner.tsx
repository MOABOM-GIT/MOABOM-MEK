import React from 'react';

export interface AppLoadingSpinnerProps {
  label?: string;
  fill?: boolean;
  className?: string;
}

export const AppLoadingSpinner: React.FC<AppLoadingSpinnerProps> = ({
  label,
  fill = false,
  className = '',
}) => {
  const rootClassName = [
    fill ? 'min-h-[200px] w-full flex-1' : '',
    'flex flex-col items-center justify-center gap-3 text-sm text-muted',
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
      <style>
        {'@keyframes moabom-loading-spin{to{transform:rotate(360deg)}}'}
      </style>
      <span
        aria-hidden="true"
        style={{
          width: '2rem',
          height: '2rem',
          borderRadius: '9999px',
          border: '3px solid rgb(148 163 184 / 0.35)',
          borderTopColor: 'rgb(var(--moa-point-rgb, 59 130 246) / 0.95)',
          animation: 'moabom-loading-spin 0.75s linear infinite',
        }}
      />
      {label ? <span>{label}</span> : null}
    </div>
  );
};

export default AppLoadingSpinner;
