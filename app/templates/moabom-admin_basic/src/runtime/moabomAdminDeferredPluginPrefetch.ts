/**
 * lazy 모듈·플러그인이 관리자 레이아웃 JSON 로드 전에 IIFE로 올라오도록 `__g7BeforeLayoutLoad`를 등록한다.
 * 코어는 G7 순정을 유지하고, 순정 `reloadModuleHandlers` / `reloadPluginHandlers`로 선로딩한다.
 *
 * @see moabom-basic `sirsoftEcommerceLayoutPrefetch.ts` (사용자 표면 동일 계약)
 */

type DeferredEntry = { js?: string; css?: string; priority?: number; external?: unknown };

type MoabomAppConfig = {
    moabom?: {
        extensionDeferredRegistry?: {
            modules?: Record<string, DeferredEntry>;
            plugins?: Record<string, DeferredEntry>;
        };
    };
};

type G7ConfigShape = {
    moduleAssets?: Record<string, DeferredEntry>;
    deferredModuleAssets?: Record<string, DeferredEntry>;
    pluginAssets?: Record<string, DeferredEntry>;
    deferredPluginAssets?: Record<string, DeferredEntry>;
    appConfig?: MoabomAppConfig;
};

const ECOMMERCE_MODULE_ID = 'sirsoft-ecommerce';
const DAUM_PLUGIN_ID = 'sirsoft-daum_postcode';
const CKEDITOR_PLUGIN_ID = 'sirsoft-ckeditor5';
const TOSSPAYMENTS_PLUGIN_ID = 'sirsoft-tosspayments';

const loadInFlight = new Map<string, Promise<void>>();

function hydrateDeferredModuleFromRegistry(cfg: G7ConfigShape, moduleId: string): boolean {
    cfg.deferredModuleAssets = cfg.deferredModuleAssets ?? {};
    const existing = cfg.deferredModuleAssets[moduleId];
    if (existing && (existing.js || existing.css)) {
        return true;
    }
    const src = cfg.appConfig?.moabom?.extensionDeferredRegistry?.modules?.[moduleId];
    if (!src || (!src.js && !src.css)) {
        return false;
    }
    cfg.deferredModuleAssets[moduleId] = { ...src };

    return true;
}

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

async function ensureDeferredModuleLoaded(moduleId: string): Promise<void> {
    const cfg = (window as unknown as { G7Config?: G7ConfigShape }).G7Config;
    const dispatch = getDispatch();
    if (!cfg || typeof dispatch !== 'function') {
        return;
    }

    const mod = cfg.moduleAssets?.[moduleId];
    if (mod && (mod.js || mod.css)) {
        return;
    }

    hydrateDeferredModuleFromRegistry(cfg, moduleId);

    const asset = cfg.deferredModuleAssets?.[moduleId];
    if (!asset) {
        return;
    }

    const key = `module:${moduleId}`;
    const existing = loadInFlight.get(key);
    if (existing) {
        await existing;

        return;
    }

    const promise = dispatch({
        handler: 'reloadModuleHandlers',
        params: {
            action: 'add',
            moduleInfo: { identifier: moduleId, assets: asset },
        },
    }).then(() => undefined);

    loadInFlight.set(key, promise);
    try {
        await promise;
    } finally {
        loadInFlight.delete(key);
    }
}

async function ensureDeferredPluginLoaded(pluginId: string): Promise<void> {
    const cfg = (window as unknown as { G7Config?: G7ConfigShape }).G7Config;
    const dispatch = getDispatch();
    if (!cfg || typeof dispatch !== 'function') {
        return;
    }

    const plg = cfg.pluginAssets?.[pluginId];
    if (plg && (plg.js || plg.css)) {
        return;
    }

    hydrateDeferredPluginFromRegistry(cfg, pluginId);

    const asset = cfg.deferredPluginAssets?.[pluginId];
    if (!asset) {
        return;
    }

    const key = `plugin:${pluginId}`;
    const existing = loadInFlight.get(key);
    if (existing) {
        await existing;

        return;
    }

    const promise = dispatch({
        handler: 'reloadPluginHandlers',
        params: {
            action: 'add',
            pluginInfo: { identifier: pluginId, assets: asset },
        },
    }).then(() => undefined);

    loadInFlight.set(key, promise);
    try {
        await promise;
    } finally {
        loadInFlight.delete(key);
    }
}

function layoutPathSuggestsAdminEcommerce(layoutPath: string): boolean {
    const p = layoutPath.toLowerCase();

    return p.startsWith('admin_ecommerce_') || p.includes('sirsoft-ecommerce.');
}

function layoutPathSuggestsCKEditor(layoutPath: string): boolean {
    const p = layoutPath.toLowerCase();
    if (p.includes('html-editor') || p.includes('htmleditor')) {
        return true;
    }
    if (p.includes('post_form') || p.includes('page_form')) {
        return true;
    }
    if (p.includes('notification_template')) {
        return true;
    }
    if (p.includes('rich-text') || p.includes('richtext')) {
        return true;
    }
    if (p.includes('description') && (p.includes('product') || p.includes('ecommerce') || p.includes('partial'))) {
        return true;
    }
    if (p.startsWith('sirsoft-page.') || p.includes('.sirsoft-page.')) {
        return true;
    }
    if (p.startsWith('board/') || p.includes('partials/board/')) {
        return true;
    }
    if (p.includes('sirsoft-board.') && /write|edit|post|form|draft|compose/.test(p)) {
        return true;
    }

    return false;
}

function layoutPathSuggestsTossPayments(layoutPath: string): boolean {
    const p = layoutPath.toLowerCase();

    return p.includes('sirsoft-tosspayments') || p.includes('checkout') || p.includes('pending_payment');
}

async function moabomAdminBeforeLayoutLoad(
    _route: { layout?: string; path?: string },
    layoutPath: string,
    templateId: string,
): Promise<void> {
    if (templateId !== 'moabom-admin_basic') {
        return;
    }

    if (layoutPathSuggestsAdminEcommerce(layoutPath)) {
        await ensureDeferredModuleLoaded(ECOMMERCE_MODULE_ID);
    }

    if (layoutPathSuggestsCKEditor(layoutPath)) {
        await ensureDeferredPluginLoaded(CKEDITOR_PLUGIN_ID);
    }

    if (layoutPathSuggestsTossPayments(layoutPath)) {
        await ensureDeferredPluginLoaded(TOSSPAYMENTS_PLUGIN_ID);
    }

    const p = layoutPath.toLowerCase();
    if (p.includes('address') || p.includes('shipping') || p.includes('postcode')) {
        await ensureDeferredPluginLoaded(DAUM_PLUGIN_ID);
    }
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

/** Vitest·회귀용 */
export {
    moabomAdminBeforeLayoutLoad,
    ensureDeferredModuleLoaded,
    ensureDeferredPluginLoaded,
    layoutPathSuggestsAdminEcommerce,
};
