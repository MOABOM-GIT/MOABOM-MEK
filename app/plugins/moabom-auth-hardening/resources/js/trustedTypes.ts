interface TrustedTypesWindow extends Window {
    trustedTypes?: {
        createPolicy: (
            name: string,
            policy: {
                createHTML?: (input: string) => string;
                createScript?: (input: string) => string;
                createScriptURL?: (input: string) => string;
            }
        ) => unknown;
        getPolicy?: (name: string) => unknown;
    };
}

let installed = false;

export function installTrustedTypesPolicy(): void {
    if (installed) return;

    const trustedTypes = (window as TrustedTypesWindow).trustedTypes;
    if (!trustedTypes || typeof trustedTypes.createPolicy !== 'function') return;

    try {
        if (typeof trustedTypes.getPolicy === 'function' && trustedTypes.getPolicy('default')) {
            installed = true;
            return;
        }

        trustedTypes.createPolicy('default', {
            createHTML: input => input,
            createScript: input => input,
            createScriptURL: input => input,
        });
        installed = true;
    } catch {
        installed = true;
    }
}

export function __resetTrustedTypesPolicyForTest(): void {
    installed = false;
}
