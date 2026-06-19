/**
 * lazy 플러그인이 관리자 레이아웃 JSON 로드 전에 IIFE로 올라오도록 `__g7BeforeLayoutLoad`를 등록한다.
 * 코어는 G7 순정을 유지하고, 순정 `reloadPluginHandlers` 액션으로 선로딩한다.
 * (moabom-basic의 `sirsoftEcommerceLayoutPrefetch`와 동일 훅이며, 관리자 템플릿 ID에서만 동작)
 */

type DeferredEntry = { js?: string; css?: string; priority?: number; external?: unknown };

type MoabomAppConfig = {
    moabom?: {
        extensionDeferredRegistry?: {
            plugins?: Record<string, DeferredEntry>;
        };
    };
};

type G7ConfigShape = {
    pluginAssets?: Record<string, DeferredEntry>;
    deferredPluginAssets?: Record<string, DeferredEntry>;
    appConfig?: MoabomAppConfig;
};

const TOSSPAYMENTS_PLUGIN_ID = 'sirsoft-tosspayments';

let tossLoadInFlight: Promise<void> | null = null;

function hydrateDeferredPluginFromRegistry(cfg: G7ConfigShape, pluginId: string): boolean {
    cfg.deferredPluginAssets = cfg.deferredPluginAssets ?? {};
    const existing = cfg.deferredPluginAssets[pluginId];
    if (existing && (existing.js || existing.css)) {
        return true;
    }
    const src = cfg.appConfig?.moabom?.extensionDeferredRegistry?.plugins?.[pluginId];
    if (!src || (!src.js && !src.css)) {
        return false;
    }
    cfg.deferredPluginAssets[pluginId] = { ...src };

    return true;
}

function getDispatch(): ((action: { handler: string; params?: Record<string, unknown> }) => Promise<unknown>) | undefined {
    const w = window as unknown as {
        G7Core?: { dispatch?: (action: { handler: string; params?: Record<string, unknown> }) => Promise<unknown> };
    };

    return typeof w.G7Core?.dispatch === 'function' ? w.G7Core.dispatch : undefined;
}

async function ensureSirsoftTosspaymentsPluginLoaded(): Promise<void> {
    const w = window as unknown as {
        G7Config?: G7ConfigShape;
    };

    const cfg = w.G7Config;
    const dispatch = getDispatch();
    if (!cfg || typeof dispatch !== 'function') {
        return;
    }

    const plg = cfg.pluginAssets?.[TOSSPAYMENTS_PLUGIN_ID];
    if (plg && (plg.js || plg.css)) {
        return;
    }

    hydrateDeferredPluginFromRegistry(cfg, TOSSPAYMENTS_PLUGIN_ID);

    if (!cfg.deferredPluginAssets?.[TOSSPAYMENTS_PLUGIN_ID]) {
        return;
    }

    if (tossLoadInFlight) {
        await tossLoadInFlight;

        return;
    }

    tossLoadInFlight = (async () => {
        const asset = cfg.deferredPluginAssets?.[TOSSPAYMENTS_PLUGIN_ID];
        if (!asset) {
            return;
        }

        await dispatch({
            handler: 'reloadPluginHandlers',
            params: {
                action: 'add',
                pluginInfo: {
                    identifier: TOSSPAYMENTS_PLUGIN_ID,
                    assets: asset,
                },
            },
        });
    })();

    try {
        await tossLoadInFlight;
    } finally {
        tossLoadInFlight = null;
    }
}

async function moabomAdminBeforeLayoutLoad(
    _route: { layout?: string; path?: string },
    layoutPath: string,
    templateId: string,
): Promise<void> {
    if (templateId !== 'moabom-admin_basic') {
        return;
    }

    const p = layoutPath.toLowerCase();
    if (!p.includes('sirsoft-tosspayments')) {
        return;
    }

    await ensureSirsoftTosspaymentsPluginLoaded();
}

/**
 * 관리자 템플릿에서 `TemplateApp` 레이아웃 fetch 직전 훅을 등록한다.
 */
export function registerMoabomAdminDeferredPluginPrefetch(): void {
    if (typeof window === 'undefined') {
        return;
    }

    (window as unknown as { __g7BeforeLayoutLoad?: typeof moabomAdminBeforeLayoutLoad }).__g7BeforeLayoutLoad =
        moabomAdminBeforeLayoutLoad;
}
