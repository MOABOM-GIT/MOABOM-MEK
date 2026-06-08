/**
 * sirsoft-ecommerce 모듈이 `loading.strategy: lazy`일 때,
 * 쇼핑·마이페이지 레이아웃(`shop/*`, `mypage/*`) JSON을 fetch하기 전에
 * `loadDeferredExtensionAssets`로 모듈 IIFE를 선로딩한다.
 *
 * `sirsoft-daum_postcode` 플러그인이 `lazy`일 때는 주소·배송·결제 관련 레이아웃 진입 전에
 * 동일 핸들러로 플러그인 IIFE를 선로딩한다.
 *
 * `sirsoft-ckeditor5` 플러그인이 `lazy`일 때는 게시·페이지·상품 설명 등 HtmlEditor가 쓰일 가능성이
 * 높은 레이아웃 경로에서만 선로딩한다.
 *
 * `sirsoft-tosspayments` 플러그인이 `lazy`일 때는 체크아웃·미결제 주문 등 PG UI 직전에 선로딩한다.
 *
 * 삽입 지점: 코어 `TemplateApp.handleRouteChange`가 `layoutLoader.loadLayout` 직전에
 * `window.__g7BeforeLayoutLoad`를 await 한다. (홈 셸 React와 무관하게 G7 라우트 전환마다 동작)
 *
 * Ghost 부트(루트)에서 `deferred*` 가 비어 있어도,
 * `G7Config.appConfig.moabom.extensionDeferredRegistry`에 보존된 맵으로 복원한 뒤 로드한다.
 */

import { ensureMoabomFullTemplateRoutesMerged, isSirsoftEcommercePresentInG7Config } from './moabomGhostRoutesFetch';

let ecommerceLoadInFlight: Promise<void> | null = null;
let daumPostcodeLoadInFlight: Promise<void> | null = null;
let ckeditor5LoadInFlight: Promise<void> | null = null;
let tosspaymentsLoadInFlight: Promise<void> | null = null;

type DeferredEntry = { js?: string; css?: string; priority?: number; external?: unknown };

type MoabomAppConfig = {
    moabom?: {
        extensionDeferredRegistry?: {
            modules?: Record<string, DeferredEntry>;
            plugins?: Record<string, DeferredEntry>;
        };
        extension_epoch?: number;
    };
};

type G7ConfigShape = {
    moduleAssets?: Record<string, DeferredEntry>;
    deferredModuleAssets?: Record<string, DeferredEntry>;
    pluginAssets?: Record<string, DeferredEntry>;
    deferredPluginAssets?: Record<string, DeferredEntry>;
    appConfig?: MoabomAppConfig;
};

/**
 * Ghost 모드로 비워진 `deferredModuleAssets`에 레지스트리에서 항목을 복사한다.
 *
 * @returns 복원 후 `deferredModuleAssets[id]` 로 로드 가능하면 true
 */
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

/**
 * Ghost 모드로 비워진 `deferredPluginAssets`에 레지스트리에서 항목을 복사한다.
 */
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

/**
 * sirsoft-ecommerce 모듈 에셋이 아직이면 `loadDeferredExtensionAssets`로 한 번만 로드한다.
 */
export async function ensureSirsoftEcommerceExtensionLoaded(): Promise<void> {
    const w = window as unknown as {
        G7Config?: G7ConfigShape;
    };

    const cfg = w.G7Config;
    const dispatch = getDispatch();
    if (!cfg || typeof dispatch !== 'function') {
        return;
    }

    const mod = cfg.moduleAssets?.['sirsoft-ecommerce'];
    if (mod && (mod.js || mod.css)) {
        return;
    }

    hydrateDeferredModuleFromRegistry(cfg, 'sirsoft-ecommerce');

    if (!cfg.deferredModuleAssets?.['sirsoft-ecommerce']) {
        return;
    }

    if (ecommerceLoadInFlight) {
        await ecommerceLoadInFlight;

        return;
    }

    ecommerceLoadInFlight = (async () => {
        await dispatch({
            handler: 'loadDeferredExtensionAssets',
            params: { moduleIdentifiers: ['sirsoft-ecommerce'] },
        });
    })();

    try {
        await ecommerceLoadInFlight;
    } finally {
        ecommerceLoadInFlight = null;
    }
}

const DAUM_PLUGIN_ID = 'sirsoft-daum_postcode';

/**
 * sirsoft-daum_postcode 플러그인이 lazy일 때, 주소·배송 UI 직전에 IIFE를 선로딩한다.
 */
export async function ensureSirsoftDaumPostcodePluginLoaded(): Promise<void> {
    const w = window as unknown as {
        G7Config?: G7ConfigShape;
    };

    const cfg = w.G7Config;
    const dispatch = getDispatch();
    if (!cfg || typeof dispatch !== 'function') {
        return;
    }

    const plg = cfg.pluginAssets?.[DAUM_PLUGIN_ID];
    if (plg && (plg.js || plg.css)) {
        return;
    }

    hydrateDeferredPluginFromRegistry(cfg, DAUM_PLUGIN_ID);

    if (!cfg.deferredPluginAssets?.[DAUM_PLUGIN_ID]) {
        return;
    }

    if (daumPostcodeLoadInFlight) {
        await daumPostcodeLoadInFlight;

        return;
    }

    daumPostcodeLoadInFlight = (async () => {
        await dispatch({
            handler: 'loadDeferredExtensionAssets',
            params: { pluginIdentifiers: [DAUM_PLUGIN_ID] },
        });
    })();

    try {
        await daumPostcodeLoadInFlight;
    } finally {
        daumPostcodeLoadInFlight = null;
    }
}

const CKEDITOR_PLUGIN_ID = 'sirsoft-ckeditor5';

/**
 * sirsoft-ckeditor5 플러그인이 lazy일 때, HtmlEditor가 예상되는 레이아웃 직전에 IIFE를 선로딩한다.
 */
export async function ensureSirsoftCkeditor5PluginLoaded(): Promise<void> {
    const w = window as unknown as {
        G7Config?: G7ConfigShape;
    };

    const cfg = w.G7Config;
    const dispatch = getDispatch();
    if (!cfg || typeof dispatch !== 'function') {
        return;
    }

    const plg = cfg.pluginAssets?.[CKEDITOR_PLUGIN_ID];
    if (plg && (plg.js || plg.css)) {
        return;
    }

    hydrateDeferredPluginFromRegistry(cfg, CKEDITOR_PLUGIN_ID);

    if (!cfg.deferredPluginAssets?.[CKEDITOR_PLUGIN_ID]) {
        return;
    }

    if (ckeditor5LoadInFlight) {
        await ckeditor5LoadInFlight;

        return;
    }

    ckeditor5LoadInFlight = (async () => {
        await dispatch({
            handler: 'loadDeferredExtensionAssets',
            params: { pluginIdentifiers: [CKEDITOR_PLUGIN_ID] },
        });
    })();

    try {
        await ckeditor5LoadInFlight;
    } finally {
        ckeditor5LoadInFlight = null;
    }
}

const TOSSPAYMENTS_PLUGIN_ID = 'sirsoft-tosspayments';

/**
 * sirsoft-tosspayments 플러그인이 lazy일 때, 결제 UI가 예상되는 레이아웃 직전에 IIFE를 선로딩한다.
 */
export async function ensureSirsoftTosspaymentsPluginLoaded(): Promise<void> {
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

    if (tosspaymentsLoadInFlight) {
        await tosspaymentsLoadInFlight;

        return;
    }

    tosspaymentsLoadInFlight = (async () => {
        await dispatch({
            handler: 'loadDeferredExtensionAssets',
            params: { pluginIdentifiers: [TOSSPAYMENTS_PLUGIN_ID] },
        });
    })();

    try {
        await tosspaymentsLoadInFlight;
    } finally {
        tosspaymentsLoadInFlight = null;
    }
}

/**
 * `TemplateApp`가 `layoutLoader.loadLayout` 직전에 await하는 훅을 등록한다.
 */
export function registerSirsoftEcommerceLayoutPrefetch(): void {
    if (typeof window === 'undefined') {
        return;
    }

    (window as unknown as { __g7BeforeLayoutLoad?: typeof moabomBeforeLayoutLoad }).__g7BeforeLayoutLoad =
        moabomBeforeLayoutLoad;
}

function layoutPathSuggestsDaumPostcode(layoutPath: string): boolean {
    return (
        layoutPath.startsWith('shop/') ||
        layoutPath.startsWith('mypage/') ||
        layoutPath.startsWith('sirsoft-ecommerce.') ||
        /address|shipping|checkout|postcode|_modal_address/i.test(layoutPath)
    );
}

/** HtmlEditor·CKEditor5가 자주 붙는 모듈 레이아웃 경로 휴리스틱(관리자·게시·페이지·상품 설명 등). */
export function layoutPathSuggestsCKEditor(layoutPath: string): boolean {
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
    if (p.includes('sirsoft-board.') && /write|edit|post|form|draft|compose/.test(p)) {
        return true;
    }

    return false;
}

/** 토스페이먼츠·requestPayment가 붙는 사용자 쇼핑 경로 휴리스틱. */
export function layoutPathSuggestsTossPayments(layoutPath: string): boolean {
    const p = layoutPath.toLowerCase();
    if (p.includes('sirsoft-tosspayments')) {
        return true;
    }
    if (p.includes('checkout')) {
        return true;
    }
    if (p.includes('pending_payment')) {
        return true;
    }

    return false;
}

async function moabomBeforeLayoutLoad(
    _route: { layout?: string; path?: string },
    layoutPath: string,
    templateId: string,
): Promise<void> {
    if (templateId !== 'moabom-basic') {
        return;
    }

    await ensureMoabomFullTemplateRoutesMerged();

    const isEcommerceLayout =
        layoutPath.startsWith('shop/') ||
        layoutPath.startsWith('mypage/') ||
        layoutPath.startsWith('sirsoft-ecommerce.');

    if (isSirsoftEcommercePresentInG7Config() && isEcommerceLayout) {
        await ensureSirsoftEcommerceExtensionLoaded();
    }

    if (layoutPathSuggestsDaumPostcode(layoutPath)) {
        await ensureSirsoftDaumPostcodePluginLoaded();
    }

    if (layoutPathSuggestsCKEditor(layoutPath)) {
        await ensureSirsoftCkeditor5PluginLoaded();
    }

    if (layoutPathSuggestsTossPayments(layoutPath)) {
        await ensureSirsoftTosspaymentsPluginLoaded();
    }
}
