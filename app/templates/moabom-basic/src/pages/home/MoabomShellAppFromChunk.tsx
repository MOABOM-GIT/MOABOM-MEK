import React, { useEffect, useState } from 'react';
import { loadMoabomShellAppComponent } from '../../apps';
import { getShellAppDeferredExtensionLoad } from '../../apps/shellDeferredExtensions';
import { createAppShellMetadata } from '../../apps/ai-generator/metadata';
import { setCreateAppEditServerId } from '../../apps/ai-generator/moabomCreateAppEditSession';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import { Div } from '../../components/basic/Div';

/** 별도 번들(`moabom-shell-*.iife.js`)에서 셸 앱을 로드해 렌더합니다. */
export const MoabomShellAppFromChunk: React.FC<{
  appId: string;
  editGeneratedAppId?: number;
}> = ({ appId, editGeneratedAppId }) => {
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
          await G7Core.dispatch({
            handler: 'loadDeferredExtensionAssets',
            params: {
              moduleIdentifiers: deferred.moduleIdentifiers,
              pluginIdentifiers: deferred.pluginIdentifiers,
            },
          });
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
      <Div className="flex min-h-full flex-col items-center justify-center p-6 text-sm text-red-500">
        {err}
      </Div>
    );
  }
  if (!Comp) {
    return (
      <Div
        className="flex min-h-full flex-col items-center justify-center gap-4 p-6"
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label={t('moa_shell.window.app_loading_aria')}
      >
        <Div className="flex w-full max-w-sm flex-col gap-3">
          <Div className="h-3 w-2/3 animate-pulse rounded-md bg-gray-200 dark:bg-slate-600" />
          <Div className="h-24 w-full animate-pulse rounded-xl bg-gray-100 dark:bg-slate-700/80" />
          <Div className="flex gap-2">
            <Div className="h-9 flex-1 animate-pulse rounded-lg bg-gray-200 dark:bg-slate-600" />
            <Div className="h-9 w-24 animate-pulse rounded-lg bg-gray-200 dark:bg-slate-600" />
          </Div>
        </Div>
        <Div className="text-center text-sm text-muted">{t('moa_shell.window.app_loading')}</Div>
      </Div>
    );
  }
  return <Comp />;
};
