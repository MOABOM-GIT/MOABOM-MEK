import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import {
  loadBoardWindowRenderPayload,
  resolveBoardWindowTitle,
  type BoardWindowMode,
  type BoardWindowRenderPayload,
} from '../../shell/boardWindowLayoutRuntime';
import {
  invalidateBoardWindowBindingCache,
  registerBoardWindowDataSession,
} from '../../shell/boardWindowDataBridge';
import {
  buildBoardPayloadCacheKey,
  resolveBoardWindowQuery,
} from '../../shell/boardWindowPrefetch';
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
  authStateKey = '',
  onResolvedTitle,
}) => {
  const { t } = useMoabomShellT();
  const onResolvedTitleRef = useRef(onResolvedTitle);
  onResolvedTitleRef.current = onResolvedTitle;

  const boardSlug = boardSlugProp ?? moaShellBoardSlugFromAppId(appId) ?? '';
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [payload, setPayload] = useState<BoardWindowRenderPayload | null>(null);
  const [dataContext, setDataContext] = useState<Record<string, unknown> | null>(null);
  const [urlEpoch, setUrlEpoch] = useState(0);
  const payloadRef = useRef<BoardWindowRenderPayload | null>(null);
  const dataContextRef = useRef<Record<string, unknown> | null>(null);
  const payloadCacheRef = useRef<Map<string, BoardWindowRenderPayload>>(new Map());
  payloadRef.current = payload;
  dataContextRef.current = dataContext;

  useEffect(() => {
    const onUrl = () => setUrlEpoch(v => v + 1);
    window.addEventListener(MOA_SHELL_BOARD_URL_EVENT, onUrl);
    return () => window.removeEventListener(MOA_SHELL_BOARD_URL_EVENT, onUrl);
  }, []);

  const load = useCallback(async () => {
    if (!boardSlug) {
      setError(t('moa_shell.center.board_error'));
      setLoading(false);
      setRefetching(false);
      return;
    }

    const query = resolveBoardWindowQuery();
    const cacheKey = buildBoardPayloadCacheKey(boardSlug, boardPostId, boardMode, query, authStateKey);
    const cached = payloadCacheRef.current.get(cacheKey);
    const keepContent = payloadRef.current != null || cached != null;

    if (cached) {
      setPayload(cached);
      setDataContext(cached.dataContext);
      setLoading(false);
      setRefetching(false);
      setError(null);
      return;
    }

    if (keepContent) {
      setRefetching(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const next = await loadBoardWindowRenderPayload(boardSlug, boardPostId, boardMode, query);
      payloadCacheRef.current.set(cacheKey, next);
      setPayload(next);
      setDataContext(next.dataContext);

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
      if (!keepContent) {
        setPayload(null);
      }
      setError(e instanceof Error ? e.message : t('moa_shell.center.board_error'));
    } finally {
      setLoading(false);
      setRefetching(false);
    }
  }, [authStateKey, boardMode, boardPostId, boardSlug, t, urlEpoch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!payload) {
      return;
    }

    const unregister = registerBoardWindowDataSession(payload, next => {
      invalidateBoardWindowBindingCache(payload.bindingEngine);
      setDataContext(next);
      const cacheKey = buildBoardPayloadCacheKey(
        boardSlug,
        boardPostId,
        boardMode,
        resolveBoardWindowQuery(),
        authStateKey,
      );
      const cached = payloadCacheRef.current.get(cacheKey);
      if (cached) {
        payloadCacheRef.current.set(cacheKey, { ...cached, dataContext: next });
      }
    });

    return unregister;
  }, [authStateKey, boardMode, boardPostId, boardSlug, payload]);

  const activeDataContext = dataContext ?? payload?.dataContext ?? null;

  if (loading && !payload) {
    return (
      <Div className={`${APP_WINDOW_BODY_CLASS} flex min-h-0 min-w-0 flex-1 flex-col`}>
        <AppLoadingSpinner label={t('moa_shell.center.board_loading')} fill />
      </Div>
    );
  }

  if (error && !payload) {
    return (
      <Div
        data-testid="moa-board-window-error"
        className={`${APP_WINDOW_BODY_CLASS} flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 py-8 text-center`}
      >
        <Div className="text-sm text-secondary">{error}</Div>
        <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
          {t('moa_shell.center.board_retry')}
        </Button>
      </Div>
    );
  }

  if (!payload || !activeDataContext) {
    return null;
  }

  const {
    DynamicRenderer,
    componentDefs,
    translationContext,
    registry,
    bindingEngine,
    translationEngine,
    actionDispatcher,
    layoutName,
  } = payload;

  return (
    <Div className={`${APP_WINDOW_BODY_CLASS} relative flex min-h-0 min-w-0 flex-1 flex-col`}>
      {refetching ? (
        <Div
          className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-[1px]"
          aria-busy="true"
          role="status"
        >
          <AppLoadingSpinner label={t('moa_shell.center.board_loading')} />
        </Div>
      ) : null}
      <MoaG7ContainerHost
        className="moa-board-window-host min-h-0 flex-1 text-primary"
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
                dataContext={activeDataContext}
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
    </Div>
  );
};
