/**
 * C2 Ghost 라우트 — `routes.json` 첫 요청을 셸 스냅샷 API로 우회하고,
 * 이커머스 경로 SPA 이동 전에 전체 라우트를 병합한다.
 *
 * @see docs/moabom-routes-ghost-api.md
 */

import { pathNeedsLegacyG7RouterPath } from '../utils/moabomLegacyMypagePaths';

const SHELL_ROUTES_API = '/api/modules/moabom-system/public/template-routes-shell';

const ECOMMERCE_MODULE_ID = 'sirsoft-ecommerce';

type ModuleEntry = { js?: string; css?: string };

/**
 * Blade `G7Config`에 이커머스 모듈 에셋 메타가 있는지(비활성/미설치 시 Ghost·이커머스 선로드 생략).
 */
export function isSirsoftEcommercePresentInG7Config(): boolean {
    const w = window as unknown as {
        G7Config?: {
            moduleAssets?: Record<string, ModuleEntry>;
            deferredModuleAssets?: Record<string, ModuleEntry>;
            appConfig?: {
                moabom?: {
                    extensionDeferredRegistry?: {
                        modules?: Record<string, ModuleEntry>;
                    };
                };
            };
        };
    };

    const c = w.G7Config;
    if (!c) {
        return false;
    }

    const ma = c.moduleAssets?.[ECOMMERCE_MODULE_ID];
    if (ma && (ma.js || ma.css)) {
        return true;
    }

    const dm = c.deferredModuleAssets?.[ECOMMERCE_MODULE_ID];
    if (dm && (dm.js || dm.css)) {
        return true;
    }

    const reg = c.appConfig?.moabom?.extensionDeferredRegistry?.modules?.[ECOMMERCE_MODULE_ID];

    return Boolean(reg && (reg.js || reg.css));
}

declare global {
    interface Window {
        __moabomGhostFetchOriginal?: typeof fetch;
        __moabomGhostFetchInstalled?: boolean;
        __moabomShellRoutesFetchMeta?: { usedGhost: boolean; cacheVersionQuery: string };
        __moabomRoutesFullMerged?: boolean;
        __templateApp?: {
            getRouter?: () => {
                navigate: (path: string) => void;
                __moabomNavigatePatched?: boolean;
            } | null;
            mergeTemplateRoutesFromData?: (routes: unknown[]) => void;
        };
    }
}

function isMoabomBasicRoutesUrl(url: string): boolean {
    try {
        const u = new URL(url, typeof location !== 'undefined' ? location.href : 'http://localhost');

        return /\/api\/templates\/moabom-basic\/routes\.json$/.test(u.pathname);
    } catch {
        return false;
    }
}

function routesCacheVersionFromUrl(url: string): string {
    try {
        const u = new URL(url, typeof location !== 'undefined' ? location.href : 'http://localhost');

        return u.searchParams.get('v') ?? '';
    } catch {
        return '';
    }
}

/** 이커머스·레거시 G7 경로 — 전체 routes.json 병합이 필요한지 */
export function pathNeedsEcommerceMergedRoutes(pathname: string): boolean {
    return pathNeedsLegacyG7RouterPath(pathname);
}

/** 초기 부트에서 셸 스냅샷 routes fetch를 쓸지 (이커머스 직접 진입이면 false). */
export function shouldUseShellRoutesSnapshotFetch(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    return !pathNeedsEcommerceMergedRoutes(window.location.pathname);
}

let fullMergeInFlight: Promise<void> | null = null;

/**
 * Ghost 셸 스냅샷 사용 후 전체 `routes.json`을 불러와 Router에 병합한다. 멱등.
 */
export async function ensureMoabomFullTemplateRoutesMerged(): Promise<void> {
    const w = window;

    if (!w.__moabomShellRoutesFetchMeta?.usedGhost || w.__moabomRoutesFullMerged) {
        return;
    }

    const orig = w.__moabomGhostFetchOriginal ?? fetch;

    if (fullMergeInFlight) {
        await fullMergeInFlight;

        return;
    }

    fullMergeInFlight = (async () => {
        const v = w.__moabomShellRoutesFetchMeta?.cacheVersionQuery ?? '';
        const qs = v !== '' && v !== '0' ? `?v=${encodeURIComponent(v)}` : v === '0' ? '?v=0' : '';
        const url = `/api/templates/moabom-basic/routes.json${qs}`;
        const res = await orig(url, { credentials: 'same-origin' });
        if (!res.ok) {
            throw new Error(`routes merge fetch failed: ${res.status}`);
        }
        const body = (await res.json()) as { success?: boolean; data?: { routes?: unknown[] } };
        if (!body?.success || !Array.isArray(body.data?.routes)) {
            throw new Error('routes merge: invalid response');
        }
        w.__templateApp?.mergeTemplateRoutesFromData?.(body.data.routes);
        w.__moabomRoutesFullMerged = true;
    })();

    try {
        await fullMergeInFlight;
    } catch (e) {
        console.warn('[moabom] full routes merge failed', e);
    } finally {
        fullMergeInFlight = null;
    }
}

function patchRouterNavigateForGhostMerge(): void {
    let attempts = 0;
    const max = 120;
    const id = window.setInterval(() => {
        attempts++;
        const router = window.__templateApp?.getRouter?.();
        if (router && !router.__moabomNavigatePatched) {
            router.__moabomNavigatePatched = true;
            const origNavigate = router.navigate.bind(router);
            router.navigate = (path: string) => {
                if (isSirsoftEcommercePresentInG7Config() && pathNeedsEcommerceMergedRoutes(path)) {
                    void ensureMoabomFullTemplateRoutesMerged().finally(() => {
                        origNavigate(path);
                    });

                    return;
                }
                origNavigate(path);
            };
            if (isSirsoftEcommercePresentInG7Config() && window.__moabomShellRoutesFetchMeta?.usedGhost) {
                void ensureMoabomFullTemplateRoutesMerged();
            }
            window.clearInterval(id);
        } else if (attempts >= max) {
            window.clearInterval(id);
        }
    }, 50);
}

export function installMoabomGhostRoutesFetch(): void {
    if (typeof window === 'undefined') {
        return;
    }
    if (window.__moabomGhostFetchInstalled) {
        return;
    }
    window.__moabomGhostFetchInstalled = true;
    const orig = window.fetch.bind(window);
    window.__moabomGhostFetchOriginal = orig;

    window.fetch = ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url =
            typeof input === 'string'
                ? input
                : input instanceof Request
                  ? input.url
                  : String(input);

        if (
            isSirsoftEcommercePresentInG7Config() &&
            isMoabomBasicRoutesUrl(url) &&
            shouldUseShellRoutesSnapshotFetch() &&
            !window.__moabomRoutesFullMerged
        ) {
            const v = routesCacheVersionFromUrl(url);
            const ghost = new URL(SHELL_ROUTES_API, window.location.origin);
            ghost.searchParams.set('template', 'moabom-basic');
            ghost.searchParams.set('scope', 'shell');
            window.__moabomShellRoutesFetchMeta = { usedGhost: true, cacheVersionQuery: v };

            return orig(ghost.toString(), {
                ...init,
                credentials: init?.credentials ?? 'same-origin',
            });
        }

        return orig(input, init);
    }) as typeof fetch;

    patchRouterNavigateForGhostMerge();
}
