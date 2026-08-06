/**
 * G7 critical fetch 패치 — config.json · home layout 을 Blade/shell-boot 스냅샷으로 대체.
 *
 * components.json 은 nginx 정적 서빙. routes 는 Ghost(shell-boot) 경로 유지.
 */

import {
  ensureMoabomShellBootLoaded,
  getMoabomShellBootData,
  type MoabomShellBootData,
} from './moabomShellBoot';
import { registerMoabomFetchHandler, resetMoabomFetchInterceptorForTest } from './moabomFetchInterceptor';

export type MoabomShellCriticalPayload = {
  template?: string;
  cache_version?: number;
  config?: Record<string, unknown> | null;
  home?: Record<string, unknown> | null;
};

declare global {
  interface Window {
    __MOABOM_SHELL_CRITICAL__?: MoabomShellCriticalPayload;
    G7Config?: { cache_version?: number };
  }
}

const TEMPLATE_ID = 'moabom-basic';

let criticalFetchInstalled = false;
let seededFromBoot = false;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
  });
}

function readInlineCritical(): MoabomShellCriticalPayload | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const payload = window.__MOABOM_SHELL_CRITICAL__;
  return payload && typeof payload === 'object' ? payload : null;
}

function criticalFromShellBoot(boot: MoabomShellBootData | null): MoabomShellCriticalPayload | null {
  const critical = (boot as MoabomShellBootData & { critical?: MoabomShellCriticalPayload })?.critical;
  if (!critical || typeof critical !== 'object') {
    return null;
  }
  return critical;
}

function mergeCritical(
  inline: MoabomShellCriticalPayload | null,
  fromBoot: MoabomShellCriticalPayload | null,
): MoabomShellCriticalPayload | null {
  if (!inline && !fromBoot) {
    return null;
  }
  return {
    template: fromBoot?.template ?? inline?.template ?? TEMPLATE_ID,
    cache_version:
      fromBoot?.cache_version
      ?? inline?.cache_version
      ?? (typeof window !== 'undefined' ? window.G7Config?.cache_version : undefined),
    config: fromBoot?.config ?? inline?.config ?? null,
    home: fromBoot?.home ?? inline?.home ?? null,
  };
}

function resolveCriticalSync(): MoabomShellCriticalPayload | null {
  return mergeCritical(readInlineCritical(), criticalFromShellBoot(getMoabomShellBootData()));
}

async function resolveCriticalAsync(nativeFetch: typeof fetch): Promise<MoabomShellCriticalPayload | null> {
  const sync = resolveCriticalSync();
  if (sync?.config && sync?.home) {
    return sync;
  }

  const boot = await ensureMoabomShellBootLoaded(nativeFetch);
  return mergeCritical(readInlineCritical(), criticalFromShellBoot(boot));
}

function isConfigUrl(pathname: string): boolean {
  return pathname === `/api/templates/${TEMPLATE_ID}/config.json`;
}

function isHomeLayoutUrl(pathname: string): boolean {
  return (
    pathname === `/api/layouts/${TEMPLATE_ID}/home.json`
    || pathname === `/api/layouts/${TEMPLATE_ID}/home`
  );
}

function configApiResponse(critical: MoabomShellCriticalPayload): Response | null {
  const config = critical.config;
  if (!config || typeof config !== 'object') {
    return null;
  }
  const cacheVersion =
    typeof critical.cache_version === 'number'
      ? critical.cache_version
      : (typeof window !== 'undefined' ? Number(window.G7Config?.cache_version ?? 0) : 0);

  return jsonResponse({
    success: true,
    data: {
      ...config,
      cache_version: cacheVersion,
    },
  });
}

function homeApiResponse(critical: MoabomShellCriticalPayload): Response | null {
  const home = critical.home;
  if (!home || typeof home !== 'object') {
    return null;
  }
  return jsonResponse({
    success: true,
    data: home,
  });
}

/**
 * shell-boot 완료 시 critical 을 window 에 병합 (재방문 SW 캐시 경로 포함).
 */
export function seedMoabomShellCriticalFromBoot(boot: MoabomShellBootData | null): void {
  if (typeof window === 'undefined' || seededFromBoot) {
    return;
  }
  const fromBoot = criticalFromShellBoot(boot);
  if (!fromBoot) {
    return;
  }
  seededFromBoot = true;
  const inline = readInlineCritical();
  window.__MOABOM_SHELL_CRITICAL__ = mergeCritical(inline, fromBoot) ?? fromBoot;
}

/**
 * TemplateApp.init 이전 설치 — config/home fetch 를 메모리 응답으로 short-circuit.
 */
export function installMoabomShellCriticalFetch(): void {
  if (typeof window === 'undefined' || criticalFetchInstalled) {
    return;
  }
  criticalFetchInstalled = true;

  const inline = readInlineCritical();
  if (inline) {
    window.__MOABOM_SHELL_CRITICAL__ = inline;
  }

  registerMoabomFetchHandler((ctx) => {
    if (!ctx.url) {
      return null;
    }
    const wantsConfig = isConfigUrl(ctx.url.pathname);
    const wantsHome = isHomeLayoutUrl(ctx.url.pathname);
    if (!wantsConfig && !wantsHome) {
      return null;
    }

    // critical 미해결(config/home 부재) 시 null 반환 → 인터셉터가 네이티브로 위임.
    return resolveCriticalAsync(ctx.native).then(critical => {
      if (!critical) {
        return null;
      }
      if (wantsConfig) {
        return configApiResponse(critical);
      }
      return homeApiResponse(critical);
    });
  });
}

/** Vitest */
export function resetMoabomShellCriticalFetchForTest(): void {
  criticalFetchInstalled = false;
  seededFromBoot = false;
  resetMoabomFetchInterceptorForTest();
}
