import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import {
  loadErrorWindowRenderPayload,
  type ErrorWindowRenderPayload,
} from '../../shell/errorWindowLayoutRuntime';
import { resolveErrorShellWindowTitle } from '../../shell/moaShellErrorTitles';
import type { ShellErrorCode } from '../../shell/moaShellErrorIds';
import { Button } from '../basic/Button';
import { Div } from '../basic/Div';
import AppLoadingSpinner from './AppLoadingSpinner';
import { APP_WINDOW_BODY_CLASS } from '../../apps/appShellTypography';
import { MoaG7ContainerHost } from './Moa_G7ContainerHost';

export interface ErrorWindowHostProps {
  errorCode: ShellErrorCode;
  onResolvedTitle?: (title: string) => void;
}

export const ErrorWindowHost: React.FC<ErrorWindowHostProps> = ({
  errorCode,
  onResolvedTitle,
}) => {
  const { t } = useMoabomShellT();
  const onResolvedTitleRef = useRef(onResolvedTitle);
  onResolvedTitleRef.current = onResolvedTitle;

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<ErrorWindowRenderPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await loadErrorWindowRenderPayload(errorCode);
      setPayload(next);
      const title = resolveErrorShellWindowTitle(errorCode, t);
      if (title && onResolvedTitleRef.current) {
        onResolvedTitleRef.current(title);
      }
    } catch (e) {
      setPayload(null);
      setError(e instanceof Error ? e.message : t('moa_shell.center.error_page_error'));
    } finally {
      setLoading(false);
    }
  }, [errorCode, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Div className={`${APP_WINDOW_BODY_CLASS} flex min-h-0 min-w-0 flex-1 flex-col`}>
        <AppLoadingSpinner label={t('moa_shell.center.error_page_loading')} fill />
      </Div>
    );
  }

  if (error || !payload) {
    return (
      <Div
        data-testid="moa-error-window-fallback"
        className={`${APP_WINDOW_BODY_CLASS} flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 py-8 text-center`}
      >
        <Div className="text-sm text-secondary">{error ?? t('moa_shell.center.error_page_error')}</Div>
        <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
          {t('moa_shell.center.error_page_retry')}
        </Button>
      </Div>
    );
  }

  const {
    DynamicRenderer,
    componentDefs,
    dataContext,
    translationContext,
    registry,
    bindingEngine,
    translationEngine,
    actionDispatcher,
    layoutName,
  } = payload;

  return (
    <MoaG7ContainerHost
      className={`${APP_WINDOW_BODY_CLASS} moa-error-window-host text-primary`}
      layoutRoots={componentDefs}
      hostTestId="moa-error-window-host"
    >
      {adaptedDefs => (
        <>
          {adaptedDefs.map((componentDef, index) => (
            <DynamicRenderer
              key={
                componentDef.id
                  ? `${componentDef.id}_${layoutName}`
                  : `error-window-${index}_${layoutName}`
              }
              componentDef={componentDef}
              dataContext={dataContext}
              translationContext={translationContext}
              registry={registry}
              bindingEngine={bindingEngine}
              translationEngine={translationEngine}
              actionDispatcher={actionDispatcher}
              isRootRenderer={index === 0}
            />
          ))}
        </>
      )}
    </MoaG7ContainerHost>
  );
};
