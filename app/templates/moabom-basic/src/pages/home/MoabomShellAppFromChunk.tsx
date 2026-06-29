import React, { useEffect, useState } from 'react';
import { APP_WINDOW_BODY_CLASS } from '../../apps/appShellTypography';
import { loadMoabomShellAppComponent } from '../../apps';
import { ensureShellAppDeferredExtensions } from '../../apps/ensureShellAppDeferredExtensions';
import { createAppShellMetadata } from '../../apps/ai-generator/metadata';
import { setCreateAppEditServerId } from '../../apps/ai-generator/moabomCreateAppEditSession';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import { ShellWindowAuthProvider } from '../../shell/ShellWindowAuthContext';
import { Div } from '../../components/basic/Div';
import AppLoadingSpinner from '../../components/composite/AppLoadingSpinner';

/** 별도 번들(`moabom-shell-*.iife.js`)에서 셸 앱을 로드해 렌더합니다. */
export const MoabomShellAppFromChunk: React.FC<{
  appId: string;
  editGeneratedAppId?: number;
  authStateKey?: string;
}> = ({ appId, editGeneratedAppId, authStateKey = '' }) => {
  const { t } = useMoabomShellT();
  const [Comp, setComp] = useState<React.ComponentType | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (appId === createAppShellMetadata.id) {
      setCreateAppEditServerId(editGeneratedAppId);
    }
    return () => {
      if (appId === createAppShellMetadata.id) {
        setCreateAppEditServerId(null);
      }
    };
  }, [appId, editGeneratedAppId]);

  useEffect(() => {
    let cancelled = false;
    setComp(null);
    setErr(null);

    const run = async () => {
      try {
        const C = await Promise.all([
          ensureShellAppDeferredExtensions(appId),
          loadMoabomShellAppComponent(appId),
        ]).then(([, component]) => component);
        if (!cancelled) {
          setComp(() => C);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : String(e));
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [appId]);

  if (err) {
    return (
      <Div className={`${APP_WINDOW_BODY_CLASS} flex min-h-full flex-col items-center justify-center text-sm text-red-500`}>
        {err}
      </Div>
    );
  }
  if (!Comp) {
    return (
      <AppLoadingSpinner
        className={APP_WINDOW_BODY_CLASS}
        label={t('moa_shell.window.app_loading')}
        fill
      />
    );
  }
  return (
    <ShellWindowAuthProvider authStateKey={authStateKey}>
      <Comp />
    </ShellWindowAuthProvider>
  );
};
