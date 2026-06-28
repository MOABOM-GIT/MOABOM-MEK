import React, { useEffect, useState } from 'react';
import { APP_WINDOW_BODY_CLASS } from '../../apps/appShellTypography';
import { loadMoabomShellAppComponent } from '../../apps';
import { getShellAppDeferredExtensionLoad } from '../../apps/shellDeferredExtensions';
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
        const deferred = getShellAppDeferredExtensionLoad(appId);
        const G7Core = (window as any).G7Core;
        if (deferred && typeof G7Core?.dispatch === 'function') {
          const cfg = (window as any).G7Config;
          for (const identifier of deferred.moduleIdentifiers) {
            const assets = cfg?.deferredModuleAssets?.[identifier];
            if (!assets) continue;
            await G7Core.dispatch({
              handler: 'reloadModuleHandlers',
              params: { action: 'add', moduleInfo: { identifier, assets } },
            });
          }
          for (const identifier of deferred.pluginIdentifiers) {
            const assets = cfg?.deferredPluginAssets?.[identifier];
            if (!assets) continue;
            await G7Core.dispatch({
              handler: 'reloadPluginHandlers',
              params: { action: 'add', pluginInfo: { identifier, assets } },
            });
          }
        }
        if (cancelled) {
          return;
        }
        const C = await loadMoabomShellAppComponent(appId);
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
