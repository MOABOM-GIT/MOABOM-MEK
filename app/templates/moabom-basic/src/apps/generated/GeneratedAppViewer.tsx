import { useEffect, useMemo, useState } from 'react';
import { fetchGeneratedApp } from '../../api/moabomAppsApi';
import { useMoabomShellT } from 'moabom-shell-i18n';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { APP_SHELL_BODY_CLASS, APP_SHELL_DESC_CLASS, APP_SHELL_PANEL_CLASS } from '../appShellTypography';
import { extractCompleteHtml, injectAiPreviewSafety } from '../ai-generator/aiHtmlUtils';

export interface GeneratedAppViewerProps {
  serverId: number;
}

export function GeneratedAppViewer({ serverId }: GeneratedAppViewerProps) {
  const { t } = useMoabomShellT();
  const [html, setHtml] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');
    setHtml('');
    setTitle('');

    void (async () => {
      try {
        const app = await fetchGeneratedApp(serverId);
        if (cancelled) {
          return;
        }
        setTitle(app.title?.trim() || `App #${app.id}`);
        setHtml(app.html ?? '');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('moa_apps_ai.viewer_error'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [serverId, t]);

  const previewHtml = useMemo(
    () => extractCompleteHtml(html) || injectAiPreviewSafety(html),
    [html],
  );

  if (isLoading) {
    return (
      <Div className="flex min-h-[320px] w-full items-center justify-center text-faint text-sm" role="status">
        {t('moa_apps_ai.viewer_loading')}
      </Div>
    );
  }

  if (error) {
    return (
      <Div className={`moa-shell-app-window ${APP_SHELL_BODY_CLASS} flex min-h-[320px] items-center justify-center p-4`}>
        <Div className={`${APP_SHELL_PANEL_CLASS} max-w-md text-center`}>
          <Icon name="exclamation-circle" className="mb-3 text-3xl text-red-500" />
          <Div className={APP_SHELL_BODY_CLASS}>{error}</Div>
        </Div>
      </Div>
    );
  }

  if (!previewHtml) {
    return (
      <Div className={`moa-shell-app-window ${APP_SHELL_BODY_CLASS} flex min-h-[320px] items-center justify-center p-4`}>
        <Div className={`${APP_SHELL_PANEL_CLASS} max-w-md text-center`}>
          <Icon name="file-alt" className="mb-3 text-3xl text-faint" />
          <Div className={APP_SHELL_BODY_CLASS}>{t('moa_apps_ai.viewer_empty')}</Div>
          {title ? <Div className={`mt-2 ${APP_SHELL_DESC_CLASS}`}>{title}</Div> : null}
        </Div>
      </Div>
    );
  }

  return (
    <Div className={`moa-shell-app-window ${APP_SHELL_BODY_CLASS} min-h-0 flex-1 p-3`}>
      <iframe
        title={title || t('moa_apps_ai.preview_title')}
        className="h-full min-h-[420px] w-full rounded-2xl border border-white/60 bg-white"
        srcDoc={previewHtml}
        sandbox="allow-scripts"
      />
    </Div>
  );
}
