/**
 * 홈 셸 부트 — `shell-boot` 1회로 frontend-defaults · template-routes-shell · providers 를 대체.
 *
 * @see deploy/unused/CLOUD-RUN-PERFORMANCE.md (P1)
 */

import type { MoabomSystemDefaults } from '../types/moabomSystem';
import { MOABOM_SHELL_BOOT_LOADED_EVENT } from '../i18n/moabomShellEvents';
import { mergeMoabomShellEssentialRoutes } from '../shell/moaShellEssentialRoutes';
import { setMoabomLocaleCatalog, type MoabomLocaleCatalog } from '../utils/moabomLocaleCatalog';
import { setShellBootApps, type ShellAppManifest } from '../apps/shellBootApps';

const SHELL_BOOT_API = '/api/modules/moabom-system/public/shell-boot';
const FRONTEND_DEFAULTS_PATH = '/api/modules/moabom-system/public/frontend-defaults';
const TEMPLATE_ROUTES_SHELL_PATH = '/api/modules/moabom-system/public/template-routes-shell';
const SOCIAL_PROVIDERS_PATH = '/api/modules/moabom-social-auth/providers';

const TEMPLATE_ID = 'moabom-basic';

export type MoabomShellRoutesPayload = {
    version?: string;
    routes?: unknown[];
};

export type MoabomShellSiteMeta = {
  is_platform?: boolean;
  site_name?: string;
    site_description?: string;
    site_note?: string;
    site_address?: string;
    site_url?: string;
    language?: string;
    timezone?: string;
    logo_light_url?: string;
    logo_dark_url?: string;
    has_custom_site_logo?: boolean;
};

export type MoabomShellBootData = {
    defaults: MoabomSystemDefaults;
    defaults_revision: number;
    site?: MoabomShellSiteMeta;
    locale_catalog?: MoabomLocaleCatalog;
    shell_routes: MoabomShellRoutesPayload;
    social_providers: string[];
    apps: ShellAppManifest[];
    shell_rankings?: {
        usage_ingest_token: string;
        usage_bucket_hour: string;
    };
};

type ShellBootApiResponse = {
    success?: boolean;
    data?: Partial<MoabomShellBootData>;
};

type MoabomShellBootShared = {
    data: MoabomShellBootData | null;
};

declare global {
    interface Window {
        __MoabomShellBoot?: MoabomShellBootShared;
    }
}

let shellBootData: MoabomShellBootData | null = null;
let shellBootLoadPromise: Promise<MoabomShellBootData | null> | null = null;
let shellBootFetchInstalled = false;

function sharedShellBoot(): MoabomShellBootShared | null {
    if (typeof window === 'undefined') {
        return null;
    }

    window.__MoabomShellBoot = window.__MoabomShellBoot ?? { data: null };

    return window.__MoabomShellBoot;
}

function readShellBootData(): MoabomShellBootData | null {
    return shellBootData ?? sharedShellBoot()?.data ?? null;
}

function writeShellBootData(data: MoabomShellBootData | null): void {
    shellBootData = data;
    const shared = sharedShellBoot();
    if (shared) {
        shared.data = data;
    }
}

function buildShellBootUrl(): string {
    const url = new URL(SHELL_BOOT_API, typeof location !== 'undefined' ? location.href : 'http://localhost');
    url.searchParams.set('template', TEMPLATE_ID);
    url.searchParams.set('scope', 'shell');

    return url.toString();
}

function isShellBootUrl(pathname: string): boolean {
    return pathname === SHELL_BOOT_API;
}

function isFrontendDefaultsUrl(pathname: string): boolean {
    return pathname === FRONTEND_DEFAULTS_PATH;
}

function isTemplateRoutesShellUrl(pathname: string): boolean {
    return pathname === TEMPLATE_ROUTES_SHELL_PATH;
}

function isSocialProvidersUrl(pathname: string): boolean {
    return pathname === SOCIAL_PROVIDERS_PATH;
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    });
}

function applyLocaleCatalog(catalog?: MoabomLocaleCatalog): void {
    if (catalog) {
        setMoabomLocaleCatalog(catalog);
    }
}

function normalizeShellBootPayload(raw: Partial<MoabomShellBootData> | undefined): MoabomShellBootData | null {
    if (!raw?.defaults || !raw.shell_routes || !Array.isArray(raw.social_providers)) {
        return null;
    }

    return {
        defaults: raw.defaults,
        defaults_revision: typeof raw.defaults_revision === 'number' ? raw.defaults_revision : 0,
        site: raw.site,
        locale_catalog: raw.locale_catalog,
        shell_routes: {
            ...raw.shell_routes,
            routes: Array.isArray(raw.shell_routes.routes)
                ? mergeMoabomShellEssentialRoutes(raw.shell_routes.routes)
                : raw.shell_routes.routes,
        },
        social_providers: raw.social_providers,
        apps: Array.isArray(raw.apps) ? raw.apps : [],
    };
}

/** Vitest: 메모리 캐시 초기화 */
export function resetMoabomShellBootCacheForTest(): void {
    writeShellBootData(null);
    shellBootLoadPromise = null;
}

/** shell-boot 페이로드가 준비됐는지 (네트워크 완료 후) */
export function getMoabomShellBootData(): MoabomShellBootData | null {
    return readShellBootData();
}

/**
 * shell-boot 1회 로드. 실패 시 null (호출부는 기존 개별 API로 폴백).
 */
export async function ensureMoabomShellBootLoaded(
    fetchImpl: typeof fetch = window.fetch.bind(window),
): Promise<MoabomShellBootData | null> {
    const cached = readShellBootData();
    if (cached) {
        return cached;
    }

    if (shellBootLoadPromise) {
        return shellBootLoadPromise;
    }

    shellBootLoadPromise = (async () => {
        try {
            const response = await fetchImpl(buildShellBootUrl(), {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });
            const payload = (await response.json()) as ShellBootApiResponse;
            if (!response.ok || !payload.success) {
                return null;
            }

            const normalized = normalizeShellBootPayload(payload.data);
            if (!normalized) {
                return null;
            }

            applyLocaleCatalog(normalized.locale_catalog);
            setShellBootApps(normalized.apps);
            writeShellBootData(normalized);
            if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                window.dispatchEvent(new CustomEvent(MOABOM_SHELL_BOOT_LOADED_EVENT, { detail: normalized }));
            }

            return normalized;
        } catch {
            return null;
        }
    })();

    try {
        return await shellBootLoadPromise;
    } finally {
        shellBootLoadPromise = null;
    }
}

function frontendDefaultsResponse(data: MoabomShellBootData): Response {
    return jsonResponse({
        success: true,
        data: {
            defaults: data.defaults,
            defaults_revision: data.defaults_revision,
            locale_catalog: data.locale_catalog,
        },
    });
}

function templateRoutesShellResponse(data: MoabomShellBootData): Response {
    return jsonResponse({
        success: true,
        data: data.shell_routes,
    });
}

function socialProvidersResponse(data: MoabomShellBootData): Response {
    return jsonResponse({
        success: true,
        data: {
            providers: data.social_providers,
        },
    });
}

async function resolveBootBackedResponse(
    pathname: string,
    nativeFetch: typeof fetch,
): Promise<Response | null> {
    const needsBoot =
        isFrontendDefaultsUrl(pathname) ||
        isTemplateRoutesShellUrl(pathname) ||
        isSocialProvidersUrl(pathname);

    if (!needsBoot) {
        return null;
    }

    const data = await ensureMoabomShellBootLoaded(nativeFetch);
    if (!data) {
        return null;
    }

    if (isFrontendDefaultsUrl(pathname)) {
        return frontendDefaultsResponse(data);
    }
    if (isTemplateRoutesShellUrl(pathname)) {
        return templateRoutesShellResponse(data);
    }

    return socialProvidersResponse(data);
}

/**
 * TemplateApp.init 이전에 호출 — shell-boot 선로드로 부트 API RTT를 1회로 줄인다.
 */
export function prefetchMoabomShellBoot(): void {
    if (typeof window === 'undefined') {
        return;
    }

    void ensureMoabomShellBootLoaded();
}

/**
 * 개별 부트 API fetch 를 shell-boot 메모리 응답으로 대체한다.
 * `installMoabomTemplateLangFetchDedupe` 직후, Ghost fetch 직전에 설치.
 */
export function installMoabomShellBootFetch(): void {
    if (typeof window === 'undefined' || shellBootFetchInstalled) {
        return;
    }
    shellBootFetchInstalled = true;

    const nativeFetch = window.fetch.bind(window);

    window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        let url: URL;
        try {
            const href =
                typeof input === 'string'
                    ? input
                    : input instanceof URL
                      ? input.href
                      : input.url;
            url = new URL(href, window.location.href);
        } catch {
            return nativeFetch(input, init);
        }

        if (isShellBootUrl(url.pathname)) {
            return nativeFetch(input, init);
        }

        return resolveBootBackedResponse(url.pathname, nativeFetch).then(bootBacked => {
            if (bootBacked) {
                return bootBacked;
            }

            return nativeFetch(input, init);
        });
    };
}

/** Vitest: fetch 패치 플래그 복원 */
export function resetMoabomShellBootFetchForTest(): void {
    shellBootFetchInstalled = false;
}
