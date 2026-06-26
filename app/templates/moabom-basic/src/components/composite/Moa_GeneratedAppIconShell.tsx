import type { App } from '../../data/Moa_apps';
import { Div } from '../basic/Div';
import { Moa_AppShellIconSurface } from './Moa_AppShellIconSurface';
import { Moa_GeneratedAppUserBadge } from './Moa_GeneratedAppUserBadge';

type GeneratedAppUserBadgeSize = 'sm' | 'md' | 'lg';

export interface Moa_GeneratedAppIconShellProps {
  app: App;
  iconClassName?: string;
  symbolClassName?: string;
  isCreateApp?: boolean;
  showUserBadge?: boolean;
  badgeSize?: GeneratedAppUserBadgeSize;
}

/**
 * 생성 앱 아이콘 — 파비콘 clip(overflow hidden)과 사용자 배지(바깥 오버랩)를 분리한다.
 */
export function Moa_GeneratedAppIconShell({
  app,
  iconClassName = '',
  symbolClassName = '',
  isCreateApp = false,
  showUserBadge = false,
  badgeSize = 'md',
}: Moa_GeneratedAppIconShellProps) {
  return (
    <Div className="moa-generated-app-icon-shell relative shrink-0">
      <Moa_AppShellIconSurface
        app={app}
        isCreateApp={isCreateApp}
        className={iconClassName}
        symbolClassName={symbolClassName}
      />
      {showUserBadge ? <Moa_GeneratedAppUserBadge size={badgeSize} /> : null}
    </Div>
  );
}
