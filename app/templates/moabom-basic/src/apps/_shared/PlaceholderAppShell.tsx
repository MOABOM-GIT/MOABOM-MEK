import type { ComponentType } from 'react';
import { useMoabomShellT } from 'moabom-shell-i18n';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import type { App } from '../../data/Moa_apps';
import { resolveAppStrings } from '../../i18n/resolveAppStrings';
import { APP_SHELL_DESC_CLASS, APP_SHELL_PANEL_BODY_CLASS, APP_WINDOW_BODY_CLASS } from '../appShellTypography';
import { AppWindowHeader } from './AppWindowHeader';

export function PlaceholderAppShell({ app }: { app: App }) {
  const { t, language } = useMoabomShellT();
  const { name, description } = resolveAppStrings(app, language);

  return (
    <Div className={`${APP_WINDOW_BODY_CLASS} min-h-full`}>
      <AppWindowHeader
        title={name}
        subtitle={description || undefined}
        icon={app.icon}
        gradient={app.gradient}
      />

      <Div className={`${APP_SHELL_PANEL_BODY_CLASS} flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center`}>
        <Icon name="hourglass-half" className="text-4xl text-faint" />
        <Div className="text-lg font-bold text-primary">{t('moa_apps_placeholder.coming_soon_title')}</Div>
        <Div className={`max-w-md ${APP_SHELL_DESC_CLASS}`}>{t('moa_apps_placeholder.coming_soon_description')}</Div>
      </Div>
    </Div>
  );
}

/** 추후 본문을 채울 플레이스홀더 셸 앱 컴포넌트 팩토리 */
export function createPlaceholderApp(metadata: App): ComponentType {
  return function PlaceholderApp() {
    return <PlaceholderAppShell app={metadata} />;
  };
}
