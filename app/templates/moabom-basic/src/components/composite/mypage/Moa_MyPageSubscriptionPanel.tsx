import React from 'react';
import type { MoabomTranslateFn } from '../../../i18n/moabomT';
import { Button } from '../../basic/Button';
import { Div } from '../../basic/Div';
import { APP_STACK_CLASS } from '../../../apps/appShellTypography';
import { ACTION_BUTTON_VARIANT, GROUP_PANEL, MY_PAGE_BLOCK_TITLE_CLASS } from './myPageStyles';

export interface Moa_MyPageSubscriptionPanelProps {
  t: MoabomTranslateFn;
}

export const Moa_MyPageSubscriptionPanel: React.FC<Moa_MyPageSubscriptionPanelProps> = ({ t }) => (
  <Div className={`moa-mypage-subscription ${APP_STACK_CLASS}`}>
    <Div className={`${GROUP_PANEL} p-5 ${APP_STACK_CLASS}`}>
      <Div className={MY_PAGE_BLOCK_TITLE_CLASS}>{t('moa_mypage.subscription.title')}</Div>
      <Div className="text-sm text-secondary">{t('moa_mypage.subscription.period')}</Div>
      <Button variant={ACTION_BUTTON_VARIANT} size="medium">
        {t('moa_mypage.subscription.manage')}
      </Button>
    </Div>
  </Div>
);
