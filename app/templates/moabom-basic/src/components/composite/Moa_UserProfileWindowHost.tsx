import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import {
  loadUserProfileWindowRenderPayload,
  resolveUserProfileWindowTitle,
  type BoardWindowRenderPayload,
} from '../../shell/userProfileWindowLayoutRuntime';
import { moaShellUserProfileUuidFromAppId } from '../../shell/moaShellUserProfileIds';
import { Button } from '../basic/Button';
import { Div } from '../basic/Div';
import AppLoadingSpinner from './AppLoadingSpinner';
import { APP_WINDOW_BODY_CLASS } from '../../apps/appShellTypography';
import { MoaG7ContainerHost } from './Moa_G7ContainerHost';

export interface UserProfileWindowHostProps {
  appId: string;
  userUuid?: string;
  authStateKey?: string;
  onResolvedTitle?: (title: string) => void;
}

export const UserProfileWindowHost: React.FC<UserProfileWindowHostProps> = ({
  appId,
  userUuid: userUuidProp,
  authStateKey,
  onResolvedTitle,
}) => {
  const { t } = useMoabomShellT();
  const onResolvedTitleRef = useRef(onResolvedTitle);
  onResolvedTitleRef.current = onResolvedTitle;

  const userUuid = userUuidProp ?? moaShellUserProfileUuidFromAppId(appId) ?? '';
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<BoardWindowRenderPayload | null>(null);

  const load = useCallback(async () => {
    if (!userUuid) {
      setError(t('moa_shell.center.user_profile_error'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await loadUserProfileWindowRenderPayload(userUuid);
      setPayload(next);

      const fetched: Record<string, unknown> = {};
      for (const key of Object.keys(next.dataContext)) {
        if (!key.startsWith('_') && key !== 'route' && key !== 'query' && key !== '$computed') {
          fetched[key] = next.dataContext[key];
        }
      }
      const title = resolveUserProfileWindowTitle(fetched);
      if (title && onResolvedTitleRef.current) {
        onResolvedTitleRef.current(title);
      }
    } catch (e) {
      setPayload(null);
      setError(e instanceof Error ? e.message : t('moa_shell.center.user_profile_error'));
    } finally {
      setLoading(false);
    }
  }, [authStateKey, t, userUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Div className={`${APP_WINDOW_BODY_CLASS} flex min-h-0 min-w-0 flex-1 flex-col`}>
        <AppLoadingSpinner label={t('moa_shell.center.user_profile_loading')} fill />
      </Div>
    );
  }

  if (error || !payload) {
    return (
      <Div
        data-testid="moa-user-profile-window-error"
        className={`${APP_WINDOW_BODY_CLASS} flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 py-8 text-center`}
      >
        <Div className="text-sm text-secondary">{error ?? t('moa_shell.center.user_profile_error')}</Div>
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
      className={`${APP_WINDOW_BODY_CLASS} moa-user-profile-window-host text-primary`}
      layoutRoots={componentDefs}
      hostTestId="moa-user-profile-window-host"
    >
      {adaptedDefs => (
        <>
          {adaptedDefs.map((componentDef, index) => (
            <DynamicRenderer
              key={
                componentDef.id
                  ? `${componentDef.id}_${layoutName}`
                  : `user-profile-window-${index}_${layoutName}`
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
