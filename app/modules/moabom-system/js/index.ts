/**
 * moabom-system 모듈 엔트리포인트
 */

import './admin/admin-components.css';
import { HomeBackgroundManager } from './admin/components/HomeBackgroundManager';
import { SortableMypageMenuList } from './admin/components/SortableMypageMenuList';
import { registerMoabomAdminDeferredPluginPrefetch } from './runtime/moabomAdminDeferredPluginPrefetch';

const MODULE_IDENTIFIER = 'moabom-system';

type ComponentRegistryLike = {
    registerExtensionComponent?: (name: string, component: unknown, metadata: unknown) => void;
    registerComponent?: (name: string, component: unknown, metadata: unknown) => void;
};

const logger = ((window as unknown as { G7Core?: { createLogger?: (n: string) => Console } }).G7Core?.createLogger?.(`Module:${MODULE_IDENTIFIER}`)) ?? {
    log: (...args: unknown[]) => console.log(`[Module:${MODULE_IDENTIFIER}]`, ...args),
    warn: (...args: unknown[]) => console.warn(`[Module:${MODULE_IDENTIFIER}]`, ...args),
    error: (...args: unknown[]) => console.error(`[Module:${MODULE_IDENTIFIER}]`, ...args),
};

const MOABOM_ADMIN_COMPONENTS = [
    {
        name: 'HomeBackgroundManager',
        component: HomeBackgroundManager,
        metadata: { name: 'HomeBackgroundManager', type: 'composite' as const, description: 'Moabom 홈 배경' },
    },
    {
        name: 'SortableMypageMenuList',
        component: SortableMypageMenuList,
        metadata: { name: 'SortableMypageMenuList', type: 'composite' as const, description: 'Moabom 마이페이지 메뉴' },
    },
];

function registerOnRegistry(registry: ComponentRegistryLike): boolean {
    const registerFn = registry.registerExtensionComponent ?? registry.registerComponent;
    if (typeof registerFn !== 'function') return false;
    for (const { name, component, metadata } of MOABOM_ADMIN_COMPONENTS) {
        registerFn.call(registry, name, component, metadata);
    }
    return true;
}

function registerAdminComponents(retry = false): void {
    const registry = (window as unknown as { G7Core?: { getComponentRegistry?: () => ComponentRegistryLike } }).G7Core?.getComponentRegistry?.();
    if (registry && registerOnRegistry(registry)) {
        logger.log(`Registered ${MOABOM_ADMIN_COMPONENTS.length} admin composite component(s)`);
        return;
    }
    if (!retry) {
        logger.warn('ComponentRegistry not found; admin components not registered');
        return;
    }
    let retryCount = 0;
    const retryRegister = () => {
        const r = (window as unknown as { G7Core?: { getComponentRegistry?: () => ComponentRegistryLike } }).G7Core?.getComponentRegistry?.();
        if (r && registerOnRegistry(r)) {
            logger.log(`Registered ${MOABOM_ADMIN_COMPONENTS.length} admin composite component(s) (delayed)`);
        } else if (retryCount++ < 50) {
            setTimeout(retryRegister, 100);
        } else {
            logger.error('Failed to register admin components');
        }
    };
    retryRegister();
}

export function initModule(): void {
    registerMoabomAdminDeferredPluginPrefetch();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => registerAdminComponents(true));
    } else {
        registerAdminComponents(!(window as unknown as { G7Core?: { getComponentRegistry?: () => unknown } }).G7Core?.getComponentRegistry?.());
    }
}

initModule();
