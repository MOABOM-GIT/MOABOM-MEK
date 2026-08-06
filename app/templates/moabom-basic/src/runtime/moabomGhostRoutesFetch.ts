/**
 * C2 Ghost 라우트 — `routes.json` 첫 요청을 shell-boot / 셸 스냅샷으로 우회하고,
 * 이커머스 경로 SPA 이동 전에 전체 라우트를 병합한다.
 *
 * @see docs/moabom-routes-ghost-api.md
 */

import {
    isMoabomBasicTemplateRoutesUrl,
    mergeEssentialRoutesInRoutesApiBody,
} from '../shell/moaShellEssentialRoutes';
import { pathNeedsLegacyG7RouterPath } from '../utils/moabomLegacyMypagePaths';
import { ensureMoabomShellBootLoaded, getMoabomShellBootData } from './moabomShellBoot';
import {
    getMoabomNativeFetch,
    registerMoabomFetchHandler,
} from './moabomFetchInterceptor';

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
    return isMoabomBasicTemplateRoutesUrl(url);
}

async function withEssentialShellRoutes(response: Response): Promise<Response> {
    if (!response.ok) {
        return response;
    }

    try {
        const body = (await response.json()) as Parameters<typeof mergeEssentialRoutesInRoutesApiBody>[0];
        const merged = mergeEssentialRoutesInRoutesApiBody(body);

        return new Response(JSON.stringify(merged), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });
    } catch {
        return response;
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
    const tryPatch = (): boolean => {
        const router = window.__templateApp?.getRouter?.();
        if (!router || router.__moabomNavigatePatched) {
            return !!router?.__moabomNavigatePatched;
        }
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
        return true;
    };

    if (tryPatch()) {
        return;
    }

    // 50ms 폴링 대신 boot phase / Mutation 대기 — document-ready 이후 재시도
    import('./moabomShellBootPipeline').then(({ whenMoabomBootPhaseAtLeast }) => {
        whenMoabomBootPhaseAtLeast('document-ready', () => {
            if (tryPatch()) {
                return;
            }
            let attempts = 0;
            const id = window.setInterval(() => {
                attempts += 1;
                if (tryPatch() || attempts >= 40) {
                    window.clearInterval(id);
                }
            }, 100);
        });
    }).catch(() => {
        let attempts = 0;
        const id = window.setInterval(() => {
            attempts += 1;
            if (tryPatch() || attempts >= 40) {
                window.clearInterval(id);
            }
        }, 100);
    });
}

async function handleGhostRoutesRequest(
    input: RequestInfo | URL,
    init: RequestInit | undefined,
    orig: typeof fetch,
): Promise<Response> {
    const url =
        typeof input === 'string'
            ? input
            : input instanceof Request
              ? input.url
              : String(input);

    if (shouldUseShellRoutesSnapshotFetch() && !window.__moabomRoutesFullMerged) {
        const v = routesCacheVersionFromUrl(url);
        window.__moabomShellRoutesFetchMeta = { usedGhost: true, cacheVersionQuery: v };

        // shell-boot 에 이미 shell_routes 있으면 네트워크 생략
        const bootRoutes = getMoabomShellBootData()?.shell_routes;
        if (bootRoutes && Array.isArray(bootRoutes.routes)) {
            return withEssentialShellRoutes(new Response(JSON.stringify({
                success: true,
                data: bootRoutes,
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            }));
        }

        // boot 미완료면 짧은 await 후 재시도 — 실패 시 Ghost API
        try {
            const boot = await ensureMoabomShellBootLoaded(orig);
            const routes = boot?.shell_routes;
            if (routes && Array.isArray(routes.routes)) {
                return withEssentialShellRoutes(new Response(JSON.stringify({
                    success: true,
                    data: routes,
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
                }));
            }
        } catch {
            /* fall through */
        }

        const ghost = new URL(SHELL_ROUTES_API, window.location.origin);
        ghost.searchParams.set('template', 'moabom-basic');
        ghost.searchParams.set('scope', 'shell');

        return withEssentialShellRoutes(await orig(ghost.toString(), {
            ...init,
            credentials: init?.credentials ?? 'same-origin',
        }));
    }

    return withEssentialShellRoutes(await orig(input, init));
}

export function installMoabomGhostRoutesFetch(): void {
    if (typeof window === 'undefined') {
        return;
    }
    if (window.__moabomGhostFetchInstalled) {
        return;
    }
    window.__moabomGhostFetchInstalled = true;
    // 전체 routes.json 병합(ensureMoabomFullTemplateRoutesMerged)은 인터셉터를 우회하는
    // 네이티브 fetch 로 실제 full routes 를 받아야 한다.
    window.__moabomGhostFetchOriginal = getMoabomNativeFetch();

    registerMoabomFetchHandler((ctx) => {
        const url =
            typeof ctx.input === 'string'
                ? ctx.input
                : ctx.input instanceof Request
                  ? ctx.input.url
                  : String(ctx.input);

        if (!isMoabomBasicRoutesUrl(url)) {
            return null;
        }

        return handleGhostRoutesRequest(ctx.input, ctx.init, ctx.native);
    });

    patchRouterNavigateForGhostMerge();
}
