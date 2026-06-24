import React from 'react';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import { Div } from '../basic/Div';
import { Span } from '../basic/Span';

export interface MoaRightPanelAdSlotProps {
  className?: string;
}

/** 우측 패널 하단 우측 고정 광고 슬롯 */
export const Moa_RightPanelAdSlot: React.FC<MoaRightPanelAdSlotProps> = ({ className = '' }) => {
  const { t } = useMoabomShellT();

  return (
    <Div
      className={`moa-right-panel-ad ${className}`.trim()}
      role="complementary"
      aria-label={t('moa_shell.right.ad_label')}
    >
      <Div className="moa-right-panel-ad__inner glass-sm-blur">
        <Span className="moa-right-panel-ad__badge" aria-hidden="true">
          {t('moa_shell.right.ad_badge')}
        </Span>
        <Span className="moa-right-panel-ad__title">{t('moa_shell.right.ad_placeholder_title')}</Span>
      </Div>
    </Div>
  );
};
