import { describe, expect, it, beforeEach } from 'vitest';
import { installMoabomExtensionDeferredBootstrap } from './moabomExtensionDeferredBootstrap';

describe('installMoabomExtensionDeferredBootstrap', () => {
    beforeEach(() => {
        (window as unknown as { G7Config?: unknown }).G7Config = undefined;
    });

    it('registry 모듈·플러그인을 G7Config.deferred* 로 복원한다', () => {
        (window as unknown as { G7Config: Record<string, unknown> }).G7Config = {
            moduleAssets: {},
            pluginAssets: {},
            appConfig: {
                moabom: {
                    extensionDeferredRegistry: {
                        modules: {
                            'sirsoft-ecommerce': { js: '/m.js', priority: 100 },
                        },
                        plugins: {
                            'sirsoft-tosspayments': { js: '/p.js', priority: 100 },
                        },
                    },
                },
            },
        };

        installMoabomExtensionDeferredBootstrap();

        const cfg = (window as unknown as { G7Config: Record<string, Record<string, unknown>> }).G7Config;
        expect(cfg.deferredModuleAssets?.['sirsoft-ecommerce']).toEqual({ js: '/m.js', priority: 100 });
        expect(cfg.deferredPluginAssets?.['sirsoft-tosspayments']).toEqual({ js: '/p.js', priority: 100 });
    });

    it('immediate moduleAssets에 있으면 deferred에 넣지 않는다', () => {
        (window as unknown as { G7Config: Record<string, unknown> }).G7Config = {
            moduleAssets: {
                'sirsoft-ecommerce': { js: '/immediate.js' },
            },
            appConfig: {
                moabom: {
                    extensionDeferredRegistry: {
                        modules: {
                            'sirsoft-ecommerce': { js: '/deferred.js' },
                        },
                        plugins: {},
                    },
                },
            },
        };

        installMoabomExtensionDeferredBootstrap();

        const cfg = (window as unknown as { G7Config: Record<string, Record<string, unknown>> }).G7Config;
        expect(cfg.deferredModuleAssets?.['sirsoft-ecommerce']).toBeUndefined();
    });
});
