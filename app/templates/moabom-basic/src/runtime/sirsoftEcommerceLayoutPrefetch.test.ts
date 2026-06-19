/**
 * sirsoft-ecommerce 레이아웃 선로딩 훅 단위 테스트
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ensureSirsoftCkeditor5PluginLoaded,
    ensureSirsoftDaumPostcodePluginLoaded,
    ensureSirsoftEcommerceExtensionLoaded,
    ensureSirsoftTosspaymentsPluginLoaded,
    layoutPathSuggestsCKEditor,
    layoutPathSuggestsTossPayments,
    registerSirsoftEcommerceLayoutPrefetch,
} from './sirsoftEcommerceLayoutPrefetch';

describe('sirsoftEcommerceLayoutPrefetch', () => {
    beforeEach(() => {
        vi.stubGlobal('window', {
            ...window,
            G7Config: {
                deferredModuleAssets: {
                    'sirsoft-ecommerce': { js: '/api/modules/assets/sirsoft-ecommerce/dist/js/module.iife.js?v=1', priority: 100 },
                },
                moduleAssets: {} as Record<string, unknown>,
            },
            G7Core: {
                dispatch: vi.fn().mockResolvedValue(undefined),
            },
        } as unknown as Window & typeof globalThis);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('ensureSirsoftEcommerceExtensionLoaded는 deferred가 있으면 reloadModuleHandlers를 호출한다', async () => {
        const w = window as unknown as { G7Core: { dispatch: ReturnType<typeof vi.fn> } };
        await ensureSirsoftEcommerceExtensionLoaded();
        expect(w.G7Core.dispatch).toHaveBeenCalledWith({
            handler: 'reloadModuleHandlers',
            params: {
                action: 'add',
                moduleInfo: {
                    identifier: 'sirsoft-ecommerce',
                    assets: { js: '/api/modules/assets/sirsoft-ecommerce/dist/js/module.iife.js?v=1', priority: 100 },
                },
            },
        });
    });

    it('이미 moduleAssets에 있으면 dispatch를 호출하지 않는다', async () => {
        (window as unknown as { G7Config: Record<string, unknown> }).G7Config = {
            moduleAssets: {
                'sirsoft-ecommerce': { js: '/x.js' },
            },
            deferredModuleAssets: {
                'sirsoft-ecommerce': { js: '/y.js' },
            },
        };
        const w = window as unknown as { G7Core: { dispatch: ReturnType<typeof vi.fn> } };
        await ensureSirsoftEcommerceExtensionLoaded();
        expect(w.G7Core.dispatch).not.toHaveBeenCalled();
    });

    it('Ghost 부트처럼 deferred가 비어도 extensionDeferredRegistry가 있으면 reloadModuleHandlers를 호출한다', async () => {
        (window as unknown as { G7Config: Record<string, unknown> }).G7Config = {
            moduleAssets: {},
            deferredModuleAssets: {},
            appConfig: {
                moabom: {
                    extensionDeferredRegistry: {
                        modules: {
                            'sirsoft-ecommerce': {
                                js: '/api/modules/assets/sirsoft-ecommerce/dist/js/module.iife.js?v=1',
                                priority: 100,
                            },
                        },
                    },
                },
            },
        };
        const w = window as unknown as { G7Core: { dispatch: ReturnType<typeof vi.fn> } };
        await ensureSirsoftEcommerceExtensionLoaded();
        expect(w.G7Core.dispatch).toHaveBeenCalledWith({
            handler: 'reloadModuleHandlers',
            params: {
                action: 'add',
                moduleInfo: {
                    identifier: 'sirsoft-ecommerce',
                    assets: { js: '/api/modules/assets/sirsoft-ecommerce/dist/js/module.iife.js?v=1', priority: 100 },
                },
            },
        });
    });

    it('registerSirsoftEcommerceLayoutPrefetch는 __g7BeforeLayoutLoad를 등록한다', () => {
        registerSirsoftEcommerceLayoutPrefetch();
        expect(typeof (window as unknown as { __g7BeforeLayoutLoad?: unknown }).__g7BeforeLayoutLoad).toBe('function');
    });

    it('ensureSirsoftDaumPostcodePluginLoaded는 deferred 플러그인이 있으면 pluginIdentifiers로 호출한다', async () => {
        const dispatch = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('window', {
            ...window,
            G7Config: {
                deferredPluginAssets: {
                    'sirsoft-daum_postcode': {
                        js: '/api/plugins/assets/sirsoft-daum_postcode/dist/js/plugin.iife.js?v=1',
                        priority: 100,
                    },
                },
                pluginAssets: {} as Record<string, unknown>,
            },
            G7Core: { dispatch },
        } as unknown as Window & typeof globalThis);

        await ensureSirsoftDaumPostcodePluginLoaded();
        expect(dispatch).toHaveBeenCalledWith({
            handler: 'reloadPluginHandlers',
            params: {
                action: 'add',
                pluginInfo: {
                    identifier: 'sirsoft-daum_postcode',
                    assets: { js: '/api/plugins/assets/sirsoft-daum_postcode/dist/js/plugin.iife.js?v=1', priority: 100 },
                },
            },
        });
    });

    it('Ghost: deferredPlugin가 비어도 extensionDeferredRegistry.plugins가 있으면 호출한다', async () => {
        const dispatch = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('window', {
            ...window,
            G7Config: {
                pluginAssets: {},
                deferredPluginAssets: {},
                appConfig: {
                    moabom: {
                        extensionDeferredRegistry: {
                            plugins: {
                                'sirsoft-daum_postcode': {
                                    js: '/api/plugins/assets/sirsoft-daum_postcode/dist/js/plugin.iife.js?v=1',
                                    priority: 100,
                                },
                            },
                        },
                    },
                },
            },
            G7Core: { dispatch },
        } as unknown as Window & typeof globalThis);

        await ensureSirsoftDaumPostcodePluginLoaded();
        expect(dispatch).toHaveBeenCalledWith({
            handler: 'reloadPluginHandlers',
            params: {
                action: 'add',
                pluginInfo: {
                    identifier: 'sirsoft-daum_postcode',
                    assets: { js: '/api/plugins/assets/sirsoft-daum_postcode/dist/js/plugin.iife.js?v=1', priority: 100 },
                },
            },
        });
    });

    it('__g7BeforeLayoutLoad(shop/*)는 이커머스 모듈과 다음 우편번호 플러그인을 순서대로 선로드한다', async () => {
        const dispatch = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('window', {
            ...window,
            G7Config: {
                moduleAssets: {},
                deferredModuleAssets: {
                    'sirsoft-ecommerce': { js: '/api/modules/assets/sirsoft-ecommerce/dist/js/module.iife.js?v=1' },
                },
                pluginAssets: {},
                deferredPluginAssets: {
                    'sirsoft-daum_postcode': {
                        js: '/api/plugins/assets/sirsoft-daum_postcode/dist/js/plugin.iife.js?v=1',
                    },
                },
            },
            G7Core: { dispatch },
        } as unknown as Window & typeof globalThis);

        registerSirsoftEcommerceLayoutPrefetch();
        const hook = (window as unknown as { __g7BeforeLayoutLoad?: (a: unknown, b: string, c: string) => Promise<void> })
            .__g7BeforeLayoutLoad;
        expect(hook).toBeTypeOf('function');
        await hook!({}, 'shop/cart', 'moabom-basic');

        expect(dispatch).toHaveBeenCalledTimes(2);
        expect(dispatch.mock.calls[0]?.[0]).toEqual({
            handler: 'reloadModuleHandlers',
            params: {
                action: 'add',
                moduleInfo: {
                    identifier: 'sirsoft-ecommerce',
                    assets: { js: '/api/modules/assets/sirsoft-ecommerce/dist/js/module.iife.js?v=1' },
                },
            },
        });
        expect(dispatch.mock.calls[1]?.[0]).toEqual({
            handler: 'reloadPluginHandlers',
            params: {
                action: 'add',
                pluginInfo: {
                    identifier: 'sirsoft-daum_postcode',
                    assets: { js: '/api/plugins/assets/sirsoft-daum_postcode/dist/js/plugin.iife.js?v=1' },
                },
            },
        });
    });

    it('G7Config에 이커머스가 없으면 shop 경로에서도 이커머스 모듈 dispatch를 호출하지 않는다', async () => {
        const dispatch = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('window', {
            ...window,
            G7Config: {
                moduleAssets: {},
                deferredModuleAssets: {},
                pluginAssets: {},
                deferredPluginAssets: {
                    'sirsoft-daum_postcode': {
                        js: '/api/plugins/assets/sirsoft-daum_postcode/dist/js/plugin.iife.js?v=1',
                    },
                },
            },
            G7Core: { dispatch },
        } as unknown as Window & typeof globalThis);

        registerSirsoftEcommerceLayoutPrefetch();
        const hook = (window as unknown as { __g7BeforeLayoutLoad?: (a: unknown, b: string, c: string) => Promise<void> })
            .__g7BeforeLayoutLoad;
        await hook!({}, 'shop/cart', 'moabom-basic');

        expect(dispatch.mock.calls.some((c) => (c[0] as { params?: { moduleIdentifiers?: string[] } })?.params?.moduleIdentifiers?.includes('sirsoft-ecommerce'))).toBe(false);
        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch.mock.calls[0]?.[0]).toEqual({
            handler: 'reloadPluginHandlers',
            params: {
                action: 'add',
                pluginInfo: {
                    identifier: 'sirsoft-daum_postcode',
                    assets: { js: '/api/plugins/assets/sirsoft-daum_postcode/dist/js/plugin.iife.js?v=1' },
                },
            },
        });
    });

    it('__g7BeforeLayoutLoad(shop/checkout)는 이커머스·다음·토스 순으로 선로드한다', async () => {
        const dispatch = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('window', {
            ...window,
            G7Config: {
                moduleAssets: {},
                deferredModuleAssets: {
                    'sirsoft-ecommerce': { js: '/api/modules/assets/sirsoft-ecommerce/dist/js/module.iife.js?v=1' },
                },
                pluginAssets: {},
                deferredPluginAssets: {
                    'sirsoft-daum_postcode': {
                        js: '/api/plugins/assets/sirsoft-daum_postcode/dist/js/plugin.iife.js?v=1',
                    },
                    'sirsoft-tosspayments': {
                        js: '/api/plugins/assets/sirsoft-tosspayments/dist/js/plugin.iife.js?v=1',
                    },
                },
            },
            G7Core: { dispatch },
        } as unknown as Window & typeof globalThis);

        registerSirsoftEcommerceLayoutPrefetch();
        const hook = (window as unknown as { __g7BeforeLayoutLoad?: (a: unknown, b: string, c: string) => Promise<void> })
            .__g7BeforeLayoutLoad;
        await hook!({}, 'shop/checkout', 'moabom-basic');

        expect(dispatch).toHaveBeenCalledTimes(3);
        expect(dispatch.mock.calls[0]?.[0]).toEqual({
            handler: 'reloadModuleHandlers',
            params: {
                action: 'add',
                moduleInfo: {
                    identifier: 'sirsoft-ecommerce',
                    assets: { js: '/api/modules/assets/sirsoft-ecommerce/dist/js/module.iife.js?v=1' },
                },
            },
        });
        expect(dispatch.mock.calls[1]?.[0]).toEqual({
            handler: 'reloadPluginHandlers',
            params: {
                action: 'add',
                pluginInfo: {
                    identifier: 'sirsoft-daum_postcode',
                    assets: { js: '/api/plugins/assets/sirsoft-daum_postcode/dist/js/plugin.iife.js?v=1' },
                },
            },
        });
        expect(dispatch.mock.calls[2]?.[0]).toEqual({
            handler: 'reloadPluginHandlers',
            params: {
                action: 'add',
                pluginInfo: {
                    identifier: 'sirsoft-tosspayments',
                    assets: { js: '/api/plugins/assets/sirsoft-tosspayments/dist/js/plugin.iife.js?v=1' },
                },
            },
        });
    });

    it('일반 홈 레이아웃 경로에서는 daum·이커머스 선로딩 dispatch를 호출하지 않는다', async () => {
        const dispatch = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('window', {
            ...window,
            G7Config: {
                moduleAssets: {},
                deferredModuleAssets: {
                    'sirsoft-ecommerce': { js: '/m.js' },
                },
                pluginAssets: {},
                deferredPluginAssets: {
                    'sirsoft-daum_postcode': { js: '/p.js' },
                },
            },
            G7Core: { dispatch },
        } as unknown as Window & typeof globalThis);

        registerSirsoftEcommerceLayoutPrefetch();
        const hook = (window as unknown as { __g7BeforeLayoutLoad?: (a: unknown, b: string, c: string) => Promise<void> })
            .__g7BeforeLayoutLoad;
        await hook!({}, 'home', 'moabom-basic');
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('ensureSirsoftCkeditor5PluginLoaded는 deferred CKEditor가 있으면 pluginIdentifiers로 호출한다', async () => {
        const dispatch = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('window', {
            ...window,
            G7Config: {
                deferredPluginAssets: {
                    'sirsoft-ckeditor5': {
                        js: '/api/plugins/assets/sirsoft-ckeditor5/dist/js/plugin.iife.js?v=1',
                        priority: 100,
                    },
                },
                pluginAssets: {} as Record<string, unknown>,
            },
            G7Core: { dispatch },
        } as unknown as Window & typeof globalThis);

        await ensureSirsoftCkeditor5PluginLoaded();
        expect(dispatch).toHaveBeenCalledWith({
            handler: 'reloadPluginHandlers',
            params: {
                action: 'add',
                pluginInfo: {
                    identifier: 'sirsoft-ckeditor5',
                    assets: { js: '/api/plugins/assets/sirsoft-ckeditor5/dist/js/plugin.iife.js?v=1', priority: 100 },
                },
            },
        });
    });

    it('ensureSirsoftTosspaymentsPluginLoaded는 deferred 토스가 있으면 pluginIdentifiers로 호출한다', async () => {
        const dispatch = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('window', {
            ...window,
            G7Config: {
                deferredPluginAssets: {
                    'sirsoft-tosspayments': {
                        js: '/api/plugins/assets/sirsoft-tosspayments/dist/js/plugin.iife.js?v=1',
                        priority: 100,
                    },
                },
                pluginAssets: {} as Record<string, unknown>,
            },
            G7Core: { dispatch },
        } as unknown as Window & typeof globalThis);

        await ensureSirsoftTosspaymentsPluginLoaded();
        expect(dispatch).toHaveBeenCalledWith({
            handler: 'reloadPluginHandlers',
            params: {
                action: 'add',
                pluginInfo: {
                    identifier: 'sirsoft-tosspayments',
                    assets: { js: '/api/plugins/assets/sirsoft-tosspayments/dist/js/plugin.iife.js?v=1', priority: 100 },
                },
            },
        });
    });

    it('게시 폼 레이아웃 경로에서는 CKEditor 플러그인만 선로드한다', async () => {
        const dispatch = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('window', {
            ...window,
            G7Config: {
                moduleAssets: {},
                deferredModuleAssets: {},
                pluginAssets: {},
                deferredPluginAssets: {
                    'sirsoft-ckeditor5': {
                        js: '/api/plugins/assets/sirsoft-ckeditor5/dist/js/plugin.iife.js?v=1',
                    },
                },
            },
            G7Core: { dispatch },
        } as unknown as Window & typeof globalThis);

        registerSirsoftEcommerceLayoutPrefetch();
        const hook = (window as unknown as { __g7BeforeLayoutLoad?: (a: unknown, b: string, c: string) => Promise<void> })
            .__g7BeforeLayoutLoad;
        await hook!({}, 'sirsoft-board.admin_board_post_form', 'moabom-basic');

        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch.mock.calls[0]?.[0]).toEqual({
            handler: 'reloadPluginHandlers',
            params: {
                action: 'add',
                pluginInfo: {
                    identifier: 'sirsoft-ckeditor5',
                    assets: { js: '/api/plugins/assets/sirsoft-ckeditor5/dist/js/plugin.iife.js?v=1' },
                },
            },
        });
    });
});

describe('layoutPathSuggestsCKEditor', () => {
    it('게시·페이지 폼·상품 설명 계열 경로에서 true', () => {
        expect(layoutPathSuggestsCKEditor('sirsoft-board.admin_board_post_form')).toBe(true);
        expect(layoutPathSuggestsCKEditor('sirsoft-page.admin_page_form')).toBe(true);
        expect(layoutPathSuggestsCKEditor('sirsoft-ecommerce.admin_partial_description')).toBe(true);
        expect(layoutPathSuggestsCKEditor('home')).toBe(false);
        expect(layoutPathSuggestsCKEditor('shop/cart')).toBe(false);
    });
});

describe('layoutPathSuggestsTossPayments', () => {
    it('checkout·미결제·토스 플러그인 레이아웃에서 true', () => {
        expect(layoutPathSuggestsTossPayments('shop/checkout')).toBe(true);
        expect(layoutPathSuggestsTossPayments('mypage/orders_pending_payment')).toBe(true);
        expect(layoutPathSuggestsTossPayments('sirsoft-tosspayments.plugin_settings')).toBe(true);
        expect(layoutPathSuggestsTossPayments('shop/cart')).toBe(false);
        expect(layoutPathSuggestsTossPayments('home')).toBe(false);
    });
});
