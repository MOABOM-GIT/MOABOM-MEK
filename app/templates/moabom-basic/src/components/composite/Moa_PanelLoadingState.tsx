import React from 'react';
import { Div } from '../basic/Div';

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
    <Div className="moa-panel-placeholder-visual" aria-hidden="true">
      <span className="moa-panel-placeholder-spinner" />
    </Div>
    {label ? <Div className="text-sm">{label}</Div> : null}
  </Div>
);

export default Moa_PanelLoadingState;
