/**
 * @see moabom-basic/src/runtime/moabomExtensionDeferredBootstrap.ts (동일 계약)
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
