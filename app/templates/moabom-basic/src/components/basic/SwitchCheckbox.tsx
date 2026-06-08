import React, { forwardRef } from 'react';
import { Label } from './Label';
import { Span } from './Span';

export interface SwitchCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
}

/**
 * 스위치 형태의 체크박스 컴포넌트입니다.
 */
export const SwitchCheckbox = forwardRef<HTMLInputElement, SwitchCheckboxProps>(
  ({ label, className = '', disabled, ...props }, ref) => {
    return (
      <Label className={`moa-switch-checkbox ${disabled ? 'moa-switch-checkbox-disabled' : ''} ${className}`}>
        <input
          ref={ref}
          type="checkbox"
          className="moa-switch-checkbox-input"
          disabled={disabled}
          {...props}
        />
        <Span className="moa-switch-checkbox-track" aria-hidden="true">
          <Span className="moa-switch-checkbox-thumb" />
        </Span>
        {label && <Span className="moa-switch-checkbox-label">{label}</Span>}
      </Label>
    );
  }
);

SwitchCheckbox.displayName = 'SwitchCheckbox';
