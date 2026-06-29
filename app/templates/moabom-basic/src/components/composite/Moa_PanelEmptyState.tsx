import React from 'react';
import { Div } from '../basic/Div';
import { Icon } from '../basic/Icon';

export interface MoaPanelEmptyStateProps {
  icon: string;
  message: React.ReactNode;
  className?: string;
}

/** 셸 패널·공개 프로필 등 공통 빈 상태 (아이콘 + 안내 문구) */
export const Moa_PanelEmptyState: React.FC<MoaPanelEmptyStateProps> = ({
  icon,
  message,
  className = '',
}) => (
  <Div className={['text-center py-8 text-muted', className].filter(Boolean).join(' ')}>
    <Div className="moa-panel-placeholder-visual">
      <Icon name={icon} />
    </Div>
    <Div className="text-sm">{message}</Div>
  </Div>
);

export default Moa_PanelEmptyState;
