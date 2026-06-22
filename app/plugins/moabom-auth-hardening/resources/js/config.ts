export interface SecurityGuardConfig {
    enabled: boolean;
    consoleMaskingEnabled: boolean;
    domGuardEnabled: boolean;
    trustedTypesEnabled: boolean;
}

interface G7Window extends Window {
    G7Config?: {
        plugins?: Record<string, Record<string, unknown>>;
    };
}

const DEFAULT_CONFIG: SecurityGuardConfig = {
    enabled: true,
    consoleMaskingEnabled: false,
    domGuardEnabled: false,
    trustedTypesEnabled: true,
};

function readBoolean(raw: unknown, fallback: boolean): boolean {
    return typeof raw === 'boolean' ? raw : fallback;
}

export function getSecurityGuardConfig(): SecurityGuardConfig {
    const pluginConfig =
        (window as G7Window).G7Config?.plugins?.['moabom-auth-hardening'] ?? {};

    return {
        enabled: readBoolean(pluginConfig.enabled, DEFAULT_CONFIG.enabled),
        consoleMaskingEnabled: readBoolean(
            pluginConfig.console_masking_enabled,
            DEFAULT_CONFIG.consoleMaskingEnabled
        ),
        domGuardEnabled: readBoolean(pluginConfig.dom_guard_enabled, DEFAULT_CONFIG.domGuardEnabled),
        trustedTypesEnabled: readBoolean(
            pluginConfig.trusted_types_enabled,
            DEFAULT_CONFIG.trustedTypesEnabled
        ),
    };
}
