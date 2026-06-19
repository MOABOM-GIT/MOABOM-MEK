/**
 * 관리자 lazy 플러그인 선로딩 훅 단위 테스트
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerMoabomAdminDeferredPluginPrefetch } from './moabomAdminDeferredPluginPrefetch';

describe('moabomAdminDeferredPluginPrefetch', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        vi.stubGlobal('window', {
            ...window,
            G7Config: {
                pluginAssets: {} as Record<string, unknown>,
                deferredPluginAssets: {
                    'sirsoft-tosspayments': {
                        js: '/api/plugins/assets/sirsoft-tosspayments/dist/js/plugin.iife.js?v=1',
                    },
                },
            },
            G7Core: { dispatch: vi.fn().mockResolvedValue(undefined) },
        } as unknown as Window & typeof globalThis);
    });

    it('registerMoabomAdminDeferredPluginPrefetch는 __g7BeforeLayoutLoad를 등록한다', () => {
        registerMoabomAdminDeferredPluginPrefetch();
        expect(typeof (window as unknown as { __g7BeforeLayoutLoad?: unknown }).__g7BeforeLayoutLoad).toBe('function');
    });

    it('sirsoft-tosspayments 레이아웃 직전에 토스 플러그인만 선로드한다', async () => {
        const dispatch = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('window', {
            ...window,
            G7Config: {
                pluginAssets: {},
                deferredPluginAssets: {
                    'sirsoft-tosspayments': { js: '/p.js' },
                },
            },
            G7Core: { dispatch },
        } as unknown as Window & typeof globalThis);

        registerMoabomAdminDeferredPluginPrefetch();
        const hook = (window as unknown as { __g7BeforeLayoutLoad?: (a: unknown, b: string, c: string) => Promise<void> })
            .__g7BeforeLayoutLoad;
        await hook!({}, 'sirsoft-tosspayments.plugin_settings', 'moabom-admin_basic');

        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenCalledWith({
            handler: 'reloadPluginHandlers',
            params: {
                action: 'add',
                pluginInfo: {
                    identifier: 'sirsoft-tosspayments',
                    assets: { js: '/p.js' },
                },
            },
        });
    });

    it('다른 관리자 레이아웃에서는 dispatch를 호출하지 않는다', async () => {
        const dispatch = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('window', {
            ...window,
            G7Config: {
                pluginAssets: {},
                deferredPluginAssets: {
                    'sirsoft-tosspayments': { js: '/p.js' },
                },
            },
            G7Core: { dispatch },
        } as unknown as Window & typeof globalThis);

        registerMoabomAdminDeferredPluginPrefetch();
        const hook = (window as unknown as { __g7BeforeLayoutLoad?: (a: unknown, b: string, c: string) => Promise<void> })
            .__g7BeforeLayoutLoad;
        await hook!({}, 'sirsoft-ecommerce.admin_dashboard', 'moabom-admin_basic');
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('moabom-basic 템플릿 ID에서는 동작하지 않는다', async () => {
        const dispatch = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('window', {
            ...window,
            G7Config: {
                pluginAssets: {},
                deferredPluginAssets: {
                    'sirsoft-tosspayments': { js: '/p.js' },
                },
            },
            G7Core: { dispatch },
        } as unknown as Window & typeof globalThis);

        registerMoabomAdminDeferredPluginPrefetch();
        const hook = (window as unknown as { __g7BeforeLayoutLoad?: (a: unknown, b: string, c: string) => Promise<void> })
            .__g7BeforeLayoutLoad;
        await hook!({}, 'sirsoft-tosspayments.plugin_settings', 'moabom-basic');
        expect(dispatch).not.toHaveBeenCalled();
    });
});
