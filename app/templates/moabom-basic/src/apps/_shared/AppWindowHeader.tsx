import type { CSSProperties } from 'react';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';

export interface AppWindowHeaderProps {
  title: string;
  subtitle?: string;
  icon?: string;
  gradient?: string;
}

/** 앱 창 상단 타이틀 — 글래스 패널 */
export function AppWindowHeader({
  title,
  subtitle,
  icon = 'cube',
  gradient = 'linear-gradient(135deg,#0ea5e9,#1d4ed8)',
}: AppWindowHeaderProps) {
  return (
    <Div
      className="moa-app-window-header moa-app-panel"
      style={{ '--moa-app-header-accent': gradient } as CSSProperties}
    >
      <Div className="moa-app-window-header__body">
        <Div className="moa-app-window-header__icon-wrap">
          <Icon name={icon} className="moa-app-window-header__icon" />
        </Div>
        <Div className="moa-app-window-header__text">
          <Div className="moa-app-window-header__title">{title}</Div>
          {subtitle ? <Div className="moa-app-window-header__subtitle">{subtitle}</Div> : null}
        </Div>
      </Div>
    </Div>
  );
}
