import type { ComponentType } from 'react';
import { useMoabomShellT } from 'moabom-shell-i18n';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import type { App } from '../../data/Moa_apps';
import { resolveAppStrings } from '../../i18n/resolveAppStrings';
import { APP_SHELL_DESC_CLASS, APP_WINDOW_BODY_CLASS } from '../appShellTypography';

export function PlaceholderAppShell({ app }: { app: App }) {
  const { t, language } = useMoabomShellT();
  const { name, description } = resolveAppStrings(app, language);

  return (
    <Div className={`${APP_WINDOW_BODY_CLASS} min-h-full`}>
      <Div className="rounded-[1.75rem] px-6 py-8 text-white shadow-xl" style={{ background: app.gradient }}>
        <Div className="flex items-center gap-4">
          <Div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/35 ring-1 ring-white/45">
            <Icon name={app.icon} className="text-2xl text-white" />
          </Div>
          <Div className="min-w-0">
            <Div className="text-2xl font-bold leading-tight tracking-tight">{name}</Div>
            {description ? (
              <Div className="mt-1.5 text-sm font-semibold leading-relaxed text-white/85">{description}</Div>
            ) : null}
          </Div>
        </Div>
      </Div>

      <Div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border border-white/55 px-6 py-16 text-center shadow-sm dark:border-white/12">
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
