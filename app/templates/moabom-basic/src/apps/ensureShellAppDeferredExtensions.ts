import { getShellAppDeferredExtensionLoad } from './shellDeferredExtensions';

/**
 * 셸 앱이 필요로 하는 lazy·layout 확장을 병렬로 선로딩한다.
 */
export async function ensureShellAppDeferredExtensions(appId: string): Promise<void> {
  const deferred = getShellAppDeferredExtensionLoad(appId);
  const G7Core = (window as { G7Core?: { dispatch?: (action: unknown) => Promise<unknown> } }).G7Core;
  if (!deferred || typeof G7Core?.dispatch !== 'function') {
    return;
  }

  const cfg = (window as { G7Config?: {
    deferredModuleAssets?: Record<string, unknown>;
    deferredPluginAssets?: Record<string, unknown>;
  } }).G7Config;

  const tasks: Promise<unknown>[] = [];

  for (const identifier of deferred.moduleIdentifiers) {
    const assets = cfg?.deferredModuleAssets?.[identifier];
    if (!assets) {
      continue;
    }
    tasks.push(G7Core.dispatch({
      handler: 'reloadModuleHandlers',
      params: { action: 'add', moduleInfo: { identifier, assets } },
    }));
  }

  for (const identifier of deferred.pluginIdentifiers) {
    const assets = cfg?.deferredPluginAssets?.[identifier];
    if (!assets) {
      continue;
    }
    tasks.push(G7Core.dispatch({
      handler: 'reloadPluginHandlers',
      params: { action: 'add', pluginInfo: { identifier, assets } },
    }));
  }

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
}
