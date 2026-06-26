/**
 * 코어 Blade는 `deferredModuleAssets` / `deferredPluginAssets`를 G7Config에 넣지 않는다.
 * 서버가 `appConfig.moabom.extensionDeferredRegistry`에 보존한 맵을
 * 클라이언트 G7Config 지연 슬롯으로 복원해 layout prefetch·reload 핸들러가 동작하게 한다.
 *
 * @see sirsoftEcommerceLayoutPrefetch.ts
 * @see extension-boot-meta-api.md
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

/**
 * TemplateApp.init 이전에 1회 호출 — registry → G7Config.deferred* (immediate 맵에 없는 항목만).
 */
export function installMoabomExtensionDeferredBootstrap(): void {
    if (typeof window === 'undefined') {
        return;
    }

    const cfg = (window as unknown as { G7Config?: G7ConfigShape }).G7Config;
    if (!cfg) {
        return;
    }

    const registry = cfg.appConfig?.moabom?.extensionDeferredRegistry;
    if (!registry) {
        return;
    }

    cfg.deferredModuleAssets = cfg.deferredModuleAssets ?? {};
    cfg.deferredPluginAssets = cfg.deferredPluginAssets ?? {};

    for (const [identifier, entry] of Object.entries(registry.modules ?? {})) {
        if (!entry?.js && !entry?.css) {
            continue;
        }
        if (cfg.moduleAssets?.[identifier]?.js || cfg.moduleAssets?.[identifier]?.css) {
            continue;
        }
        const existing = cfg.deferredModuleAssets[identifier];
        if (existing?.js || existing?.css) {
            continue;
        }
        cfg.deferredModuleAssets[identifier] = { ...entry };
    }

    for (const [identifier, entry] of Object.entries(registry.plugins ?? {})) {
        if (!entry?.js && !entry?.css) {
            continue;
        }
        if (cfg.pluginAssets?.[identifier]?.js || cfg.pluginAssets?.[identifier]?.css) {
            continue;
        }
        const existing = cfg.deferredPluginAssets[identifier];
        if (existing?.js || existing?.css) {
            continue;
        }
        cfg.deferredPluginAssets[identifier] = { ...entry };
    }
}
