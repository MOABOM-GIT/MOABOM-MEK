import React from 'react';
import { Div } from '../basic/Div';
import { MOABOM_SPIN_KEYFRAMES } from './AppLoadingSpinner';

/** PanelEmptyState 아이콘(text-3xl)과 동일한 시각 슬롯 */
const PANEL_SPINNER_SIZE = '1.875rem';

export interface MoaPanelLoadingStateProps {
  label?: string;
  className?: string;
}

/** 셸 좌·우 패널 공통 로딩 상태 — PanelEmptyState와 동일 레이아웃(아이콘 슬롯·간격·문구) */
export const Moa_PanelLoadingState: React.FC<MoaPanelLoadingStateProps> = ({
  label,
  className = '',
}) => (
  <Div
    className={['text-center py-8 text-muted', className].filter(Boolean).join(' ')}
    role="status"
    aria-busy="true"
    aria-live="polite"
    aria-label={label || 'Loading'}
  >
    <Div className="mb-2 flex justify-center opacity-30" aria-hidden="true">
      <style>{MOABOM_SPIN_KEYFRAMES}</style>
      <span
        style={{
          width: PANEL_SPINNER_SIZE,
          height: PANEL_SPINNER_SIZE,
          borderRadius: '9999px',
          border: '3px solid rgb(148 163 184 / 0.35)',
          borderTopColor: 'rgb(var(--moa-point-rgb, 59 130 246) / 0.95)',
          animation: 'moabom-loading-spin 0.75s linear infinite',
        }}
      />
    </Div>
    {label ? <Div className="text-sm">{label}</Div> : null}
  </Div>
);

export default Moa_PanelLoadingState;
