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
import { registerMoabomFetchHandler, resetMoabomFetchInterceptorForTest } from './moabomFetchInterceptor';

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
    critical?: {
        template?: string;
        cache_version?: number;
        config?: Record<string, unknown> | null;
        home?: Record<string, unknown> | null;
    };
};

type ShellBootApiResponse = {
    success?: boolean;
    data?: Partial<MoabomShellBootData>;
};

type MoabomShellBootShared = {
    data: MoabomShellBootData | null;
    promise: Promise<MoabomShellBootData | null> | null;
    generation: number;
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

    window.__MoabomShellBoot = window.__MoabomShellBoot ?? {
        data: null,
        promise: null,
        generation: 0,
    };
    window.__MoabomShellBoot.promise ??= null;
    window.__MoabomShellBoot.generation ??= 0;

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

function delay(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

const COLD_START_RETRY_STATUSES = new Set([502, 503, 504]);
const COLD_START_MAX_ATTEMPTS = 5;

async function fetchShellBootWithColdStartRetry(
    fetchImpl: typeof fetch,
): Promise<Response> {
    let lastResponse: Response | null = null;

    for (let attempt = 1; attempt <= COLD_START_MAX_ATTEMPTS; attempt++) {
        try {
            const response = await fetchImpl(buildShellBootUrl(), {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });
            lastResponse = response;

            if (response.ok || !COLD_START_RETRY_STATUSES.has(response.status)) {
                return response;
            }
        } catch {
            if (attempt >= COLD_START_MAX_ATTEMPTS) {
                throw new Error('shell-boot fetch failed after retries');
            }
        }

        if (attempt < COLD_START_MAX_ATTEMPTS) {
            await delay(Math.min(1000 * 2 ** (attempt - 1), 8000));
        }
    }

    if (lastResponse) {
        return lastResponse;
    }

    throw new Error('shell-boot fetch failed');
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
        shell_rankings: raw.shell_rankings,
        critical: raw.critical,
    };
}

/** shell-boot 메모리 캐시 무효화 (PWA 확장 재동기화·테스트 공용). */
export function invalidateMoabomShellBootCache(): void {
    writeShellBootData(null);
    shellBootLoadPromise = null;
    const shared = sharedShellBoot();
    if (shared) {
        shared.promise = null;
        shared.generation += 1;
    }
}

/** Vitest: 메모리 캐시 초기화 */
export function resetMoabomShellBootCacheForTest(): void {
    invalidateMoabomShellBootCache();
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
    const shared = sharedShellBoot();
    if (shared?.promise) {
        return shared.promise;
    }

    const generation = shared?.generation ?? 0;
    const loadPromise = (async () => {
        try {
            const response = await fetchShellBootWithColdStartRetry(fetchImpl);
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
            try {
                const { seedMoabomShellCriticalFromBoot } = await import('./moabomShellCriticalFetch');
                seedMoabomShellCriticalFromBoot(normalized);
            } catch {
                // critical seed optional
            }
            if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                window.dispatchEvent(new CustomEvent(MOABOM_SHELL_BOOT_LOADED_EVENT, { detail: normalized }));
            }

            return normalized;
        } catch {
            return null;
        }
    })();
    shellBootLoadPromise = loadPromise;
    if (shared) {
        shared.promise = loadPromise;
    }

    try {
        return await loadPromise;
    } finally {
        if (shellBootLoadPromise === loadPromise) {
            shellBootLoadPromise = null;
        }
        if (shared?.promise === loadPromise && shared.generation === generation) {
            shared.promise = null;
        }
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

    registerMoabomFetchHandler((ctx) => {
        if (!ctx.url || isShellBootUrl(ctx.url.pathname)) {
            return null;
        }

        // frontend-defaults · template-routes-shell · social-providers 를 shell-boot 응답으로 대체.
        // 미해당 경로는 resolveBootBackedResponse 가 null 을 반환 → 인터셉터가 네이티브로 위임.
        return resolveBootBackedResponse(ctx.url.pathname, ctx.native);
    });
}

/** Vitest: fetch 패치 플래그 복원 */
export function resetMoabomShellBootFetchForTest(): void {
    shellBootFetchInstalled = false;
    resetMoabomFetchInterceptorForTest();
}
