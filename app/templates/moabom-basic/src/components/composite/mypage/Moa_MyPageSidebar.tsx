import React from 'react';
import type { MoabomTranslateFn } from '../../../i18n/moabomT';
import { Button } from '../../basic/Button';
import { Div } from '../../basic/Div';
import { Icon } from '../../basic/Icon';
import { Span } from '../../basic/Span';
import { Moa_OverflowMarqueeText } from '../Moa_OverflowMarqueeText';
import type { MyPageSidebarTab } from './myPageMenuModel';
import type { MyPageTab } from './myPageTypes';
import {
  ACTIVE_TAB_CLASS,
  DISABLED_TAB_CLASS,
  INACTIVE_TAB_CLASS,
  SIDEBAR_GROUP,
  TAB_BUTTON_BASE,
} from './myPageStyles';

export interface Moa_MyPageSidebarProps {
  t: MoabomTranslateFn;
  tabs: MyPageSidebarTab[];
  activeTab: MyPageTab;
  isGuest: boolean;
  onSelectTab: (tabId: MyPageTab) => void;
}

export const Moa_MyPageSidebar: React.FC<Moa_MyPageSidebarProps> = ({
  t,
  tabs,
  activeTab,
  isGuest,
  onSelectTab,
}) => (
  <Div className={`moa-mypage-sidebar ${SIDEBAR_GROUP}`}>
    <Div className="moa-mypage-sidebar-nav flex flex-col gap-2">
      {tabs.map(tab => {
        const enabled = !isGuest || tab.guestEnabled;
        const tabActive = activeTab === tab.id;

        return (
          <Button
            key={tab.id}
            onClick={() => {
              if (enabled) onSelectTab(tab.id);
            }}
            disabled={!enabled}
            className={`group ${TAB_BUTTON_BASE} ${
              tabActive ? ACTIVE_TAB_CLASS : enabled ? INACTIVE_TAB_CLASS : DISABLED_TAB_CLASS
            }`}
          >
            <Icon
              name={enabled ? tab.icon : 'lock'}
              className={`text-base ${tabActive ? 'text-white' : enabled ? 'text-primary' : 'text-faint'}`}
            />
            <Div className="min-w-0 flex-1">
              <Moa_OverflowMarqueeText
                text={tab.label}
                className={`text-sm font-bold ${tabActive ? 'text-white' : enabled ? 'text-primary' : 'text-faint'}`}
              />
              <Div className="moa-mypage-menu-desc min-w-0">
                <Span
                  className={`block w-full text-xs mt-0.5 leading-snug break-words text-start whitespace-normal [overflow-wrap:anywhere] ${
                    tabActive ? 'text-white/75' : enabled ? 'text-muted' : 'text-faint'
                  }`}
                >
                  {enabled ? tab.desc : t('moa_mypage.common.login_required_hint')}
                </Span>
              </Div>
            </Div>
          </Button>
        );
      })}
    </Div>
  </Div>
);
