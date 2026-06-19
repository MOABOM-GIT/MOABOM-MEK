import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import {
  loadBoardWindowRenderPayload,
  resolveBoardWindowTitle,
  type BoardWindowMode,
  type BoardWindowRenderPayload,
} from '../../shell/boardWindowLayoutRuntime';
import { moaShellBoardSlugFromAppId } from '../../shell/moaShellBoardIds';
import { MOA_SHELL_BOARD_URL_EVENT } from '../../shell/moaShellBoardBridge';
import { Button } from '../basic/Button';
import { Div } from '../basic/Div';
import AppLoadingSpinner from './AppLoadingSpinner';
import { APP_WINDOW_BODY_CLASS } from '../../apps/appShellTypography';
import { MoaG7ContainerHost } from './Moa_G7ContainerHost';

export interface BoardWindowHostProps {
  boardSlug?: string;
  boardPostId?: string;
  boardMode?: BoardWindowMode;
  appId: string;
  authStateKey?: string;
  onResolvedTitle?: (title: string) => void;
}

export const BoardWindowHost: React.FC<BoardWindowHostProps> = ({
  boardSlug: boardSlugProp,
  boardPostId,
  boardMode,
  appId,
  authStateKey,
  onResolvedTitle,
}) => {
  const { t } = useMoabomShellT();
  const onResolvedTitleRef = useRef(onResolvedTitle);
  onResolvedTitleRef.current = onResolvedTitle;

  const boardSlug = boardSlugProp ?? moaShellBoardSlugFromAppId(appId) ?? '';
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<BoardWindowRenderPayload | null>(null);
  const [urlEpoch, setUrlEpoch] = useState(0);

  useEffect(() => {
    const onUrl = () => setUrlEpoch(v => v + 1);
    window.addEventListener(MOA_SHELL_BOARD_URL_EVENT, onUrl);
    return () => window.removeEventListener(MOA_SHELL_BOARD_URL_EVENT, onUrl);
  }, []);

  const load = useCallback(async () => {
    if (!boardSlug) {
      setError(t('moa_shell.center.board_error'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await loadBoardWindowRenderPayload(boardSlug, boardPostId, boardMode);
      setPayload(next);

      const fetched: Record<string, unknown> = {};
      for (const key of Object.keys(next.dataContext)) {
        if (!key.startsWith('_') && key !== 'route' && key !== 'query' && key !== '$computed') {
          fetched[key] = next.dataContext[key];
        }
      }
      const title = resolveBoardWindowTitle(boardSlug, boardPostId, fetched);
      if (title && onResolvedTitleRef.current) {
        onResolvedTitleRef.current(title);
      }
    } catch (e) {
      setPayload(null);
      setError(e instanceof Error ? e.message : t('moa_shell.center.board_error'));
    } finally {
      setLoading(false);
    }
  }, [authStateKey, boardMode, boardPostId, boardSlug, t, urlEpoch]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Div className={`${APP_WINDOW_BODY_CLASS} flex min-h-0 min-w-0 flex-1 flex-col`}>
        <AppLoadingSpinner label={t('moa_shell.center.board_loading')} fill />
      </Div>
    );
  }

  if (error || !payload) {
    return (
      <Div
        data-testid="moa-board-window-error"
        className={`${APP_WINDOW_BODY_CLASS} flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 py-8 text-center`}
      >
        <Div className="text-sm text-secondary">{error ?? t('moa_shell.center.board_error')}</Div>
        <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
          {t('moa_shell.center.board_retry')}
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
      className={`${APP_WINDOW_BODY_CLASS} moa-board-window-host text-primary`}
      layoutRoots={componentDefs}
      hostTestId="moa-board-window-host"
    >
      {adaptedDefs => (
        <>
          {adaptedDefs.map((componentDef, index) => (
            <DynamicRenderer
              key={
                componentDef.id
                  ? `${componentDef.id}_${layoutName}`
                  : `board-window-${index}_${layoutName}`
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
