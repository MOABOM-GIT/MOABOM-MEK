import { useEffect, useState } from 'react';
import { resolveMoabomExtensionCacheVersion } from '../i18n/moabomTemplateLangJsonFetch';
import { getMoabomShellBootData } from '../runtime/moabomShellBoot';
import { whenMoabomBootPhaseAtLeast } from '../runtime/moabomShellBootPipeline';
import { MOABOM_SHELL_BOOT_LOADED_EVENT } from '../i18n/moabomShellEvents';

export const MOABOM_DEFAULT_LOGO_LIGHT =
  '/api/templates/assets/moabom-basic/img/logo_smartcare.svg';

export const MOABOM_DEFAULT_LOGO_DARK =
  '/api/templates/assets/moabom-basic/img/logo_smartcare_w.svg';

const ATTACHMENT_LOGO_PREFIX = '/api/attachment/';

export type MoabomSiteBrandingUrls = {
  lightUrl: string;
  darkUrl: string;
};

/** 플랫폼(mek360.com) 우측 패널 기본 브랜드명 */
export const MOABOM_PLATFORM_DISPLAY_NAME = '스마트케어360';

export function isMoabomCustomAttachmentLogoUrl(url: string): boolean {
  return url.startsWith(ATTACHMENT_LOGO_PREFIX);
}

export function isMoabomBundledSiteLogoUrl(url: string): boolean {
  const path = url.split('?')[0] ?? url;

  return /^\/api\/templates\/assets\/moabom-basic\/img\/logo_smartcare(?:_w)?\.svg$/.test(path);
}

/** 템플릿 번들 SVG — extension cache version 쿼리로 SW·브라우저 캐시 무효화. */
export function withMoabomBundledLogoCacheVersion(url: string): string {
  if (!isMoabomBundledSiteLogoUrl(url)) {
    return url;
  }

  const cv = resolveMoabomExtensionCacheVersion();
  if (cv <= 0) {
    return url.split('?')[0] ?? url;
  }

  const base = url.split('?')[0] ?? url;

  return `${base}?v=${cv}`;
}

export function normalizeMoabomSiteLogoUrl(url: string): string {
  if (isMoabomCustomAttachmentLogoUrl(url)) {
    return url;
  }

  return withMoabomBundledLogoCacheVersion(url);
}

export function resolveMoabomSiteLogoFallbackUrl(mode: 'light' | 'dark'): string {
  const base = mode === 'dark' ? MOABOM_DEFAULT_LOGO_DARK : MOABOM_DEFAULT_LOGO_LIGHT;

  return withMoabomBundledLogoCacheVersion(base);
}

/** `<img onError>` — 동일 src 재설정만으로는 재시도가 안 되므로 retry 쿼리 또는 버전 URL로 복구. */
export function resolveMoabomSiteLogoImgRecoveryUrl(
  currentSrc: string,
  mode: 'light' | 'dark',
): string {
  const fallback = resolveMoabomSiteLogoFallbackUrl(mode);
  const fallbackBase = fallback.split('?')[0] ?? fallback;
  const currentBase = currentSrc.split('?')[0] ?? currentSrc;

  if (currentBase === fallbackBase) {
    return appendLogoRetryQuery(fallback);
  }

  return fallback;
}

/** attachment URL은 preload 전까지 번들 SVG를 노출해 엑박을 막는다. */
export function resolveMoabomSiteLogoDisplayUrls(): MoabomSiteBrandingUrls {
  const raw = resolveMoabomSiteLogoUrls();

  return {
    lightUrl: isMoabomCustomAttachmentLogoUrl(raw.lightUrl)
      ? resolveMoabomSiteLogoFallbackUrl('light')
      : normalizeMoabomSiteLogoUrl(raw.lightUrl),
    darkUrl: isMoabomCustomAttachmentLogoUrl(raw.darkUrl)
      ? resolveMoabomSiteLogoFallbackUrl('dark')
      : normalizeMoabomSiteLogoUrl(raw.darkUrl),
  };
}

function appendLogoRetryQuery(url: string): string {
  return url.includes('?') ? `${url}&retry=1` : `${url}?retry=1`;
}

function preloadImageUrl(url: string): Promise<boolean> {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

/**
 * site_logo attachment·번들 SVG 모두 cold start·SW 캐시 비운 직후 간헐 실패할 수 있어
 * preload·1회 재시도 후 폴백(attachment) 또는 버전 URL(번들)을 반환한다.
 */
export async function preloadMoabomSiteLogoUrl(
  url: string,
  fallbackUrl: string,
): Promise<string> {
  const versionedFallback = normalizeMoabomSiteLogoUrl(fallbackUrl);

  if (isMoabomCustomAttachmentLogoUrl(url)) {
    if (await preloadImageUrl(url)) {
      return url;
    }

    if (await preloadImageUrl(appendLogoRetryQuery(url))) {
      return url;
    }

    return versionedFallback;
  }

  const versioned = normalizeMoabomSiteLogoUrl(url);

  if (await preloadImageUrl(versioned)) {
    return versioned;
  }

  if (await preloadImageUrl(appendLogoRetryQuery(versioned))) {
    return appendLogoRetryQuery(versioned);
  }

  return versionedFallback;
}

export async function resolveMoabomSiteLogoUrlsWithPreload(): Promise<MoabomSiteBrandingUrls> {
  const raw = resolveMoabomSiteLogoUrls();

  const [lightUrl, darkUrl] = await Promise.all([
    preloadMoabomSiteLogoUrl(raw.lightUrl, MOABOM_DEFAULT_LOGO_LIGHT),
    preloadMoabomSiteLogoUrl(raw.darkUrl, MOABOM_DEFAULT_LOGO_DARK),
  ]);

  return { lightUrl, darkUrl };
}

/** shell-boot site_name — 테넌트 업체명, 플랫폼(mek360)은 스마트케어360 */
export function resolveMoabomSiteDisplayName(): string {
  const site = getMoabomShellBootData()?.site;
  if (site?.is_platform === true) {
    return MOABOM_PLATFORM_DISPLAY_NAME;
  }

  const fromBoot = site?.site_name?.trim();
  return fromBoot !== '' && fromBoot != null ? fromBoot : MOABOM_PLATFORM_DISPLAY_NAME;
}

export function useMoabomSiteDisplayName(): string {
  const [name, setName] = useState<string>(() => resolveMoabomSiteDisplayName());

  useEffect(() => {
    const refresh = (): void => setName(resolveMoabomSiteDisplayName());
    refresh();
    if (typeof window === 'undefined') {
      return;
    }
    window.addEventListener(MOABOM_SHELL_BOOT_LOADED_EVENT, refresh);
    return () => window.removeEventListener(MOABOM_SHELL_BOOT_LOADED_EVENT, refresh);
  }, []);

  return name;
}

/** shell-boot `site` 메타 + 템플릿 SVG 폴백. */
export function resolveMoabomSiteLogoUrls(): MoabomSiteBrandingUrls {
  const site = getMoabomShellBootData()?.site as
    | { logo_light_url?: string; logo_dark_url?: string }
    | undefined;

  const light = typeof site?.logo_light_url === 'string' ? site.logo_light_url.trim() : '';
  const dark = typeof site?.logo_dark_url === 'string' ? site.logo_dark_url.trim() : '';

  return {
    lightUrl: normalizeMoabomSiteLogoUrl(light !== '' ? light : MOABOM_DEFAULT_LOGO_LIGHT),
    darkUrl: normalizeMoabomSiteLogoUrl(dark !== '' ? dark : MOABOM_DEFAULT_LOGO_DARK),
  };
}

/**
 * shell-boot 비동기 로드 후에도 로고 URL이 갱신되도록 구독.
 * 커스텀 attachment 는 tertiary-idle 이후 preload 성공 시에만 src 를 바꿔
 * 콜드 부트 PHP 큐와 attachment 504 경합을 피한다.
 */
export function useMoabomSiteLogoUrls(): MoabomSiteBrandingUrls {
  const [urls, setUrls] = useState<MoabomSiteBrandingUrls>(() => resolveMoabomSiteLogoDisplayUrls());

  useEffect(() => {
    let cancelled = false;
    let cancelBoot: (() => void) | undefined;

    const applyDisplay = (): void => {
      setUrls(resolveMoabomSiteLogoDisplayUrls());
    };

    const schedulePreload = (): void => {
      cancelBoot?.();
      cancelBoot = whenMoabomBootPhaseAtLeast('tertiary-idle', () => {
        void resolveMoabomSiteLogoUrlsWithPreload().then(resolved => {
          if (!cancelled) {
            setUrls(resolved);
          }
        });
      });
    };

    applyDisplay();
    schedulePreload();

    if (typeof window === 'undefined') {
      return;
    }

    const onBootLoaded = (): void => {
      applyDisplay();
      schedulePreload();
    };

    window.addEventListener(MOABOM_SHELL_BOOT_LOADED_EVENT, onBootLoaded);

    return () => {
      cancelled = true;
      cancelBoot?.();
      window.removeEventListener(MOABOM_SHELL_BOOT_LOADED_EVENT, onBootLoaded);
    };
  }, []);

  return urls;
}
