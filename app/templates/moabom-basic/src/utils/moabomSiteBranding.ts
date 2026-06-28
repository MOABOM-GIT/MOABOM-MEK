import { useEffect, useState } from 'react';
import { getMoabomShellBootData } from '../runtime/moabomShellBoot';
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

export function resolveMoabomSiteLogoFallbackUrl(mode: 'light' | 'dark'): string {
  return mode === 'dark' ? MOABOM_DEFAULT_LOGO_DARK : MOABOM_DEFAULT_LOGO_LIGHT;
}

/** attachment URL은 preload 전까지 번들 SVG를 노출해 엑박을 막는다. */
export function resolveMoabomSiteLogoDisplayUrls(): MoabomSiteBrandingUrls {
  const raw = resolveMoabomSiteLogoUrls();

  return {
    lightUrl: isMoabomCustomAttachmentLogoUrl(raw.lightUrl)
      ? MOABOM_DEFAULT_LOGO_LIGHT
      : raw.lightUrl,
    darkUrl: isMoabomCustomAttachmentLogoUrl(raw.darkUrl)
      ? MOABOM_DEFAULT_LOGO_DARK
      : raw.darkUrl,
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
 * 커스텀 site_logo attachment 는 cold start 등으로 간헐 실패할 수 있어
 * 1회 재시도 후 번들 SVG로 폴백한다. 번들 asset URL은 그대로 반환한다.
 */
export async function preloadMoabomSiteLogoUrl(
  url: string,
  fallbackUrl: string,
): Promise<string> {
  if (!isMoabomCustomAttachmentLogoUrl(url)) {
    return url;
  }

  if (await preloadImageUrl(url)) {
    return url;
  }

  if (await preloadImageUrl(appendLogoRetryQuery(url))) {
    return url;
  }

  return fallbackUrl;
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
    lightUrl: light !== '' ? light : MOABOM_DEFAULT_LOGO_LIGHT,
    darkUrl: dark !== '' ? dark : MOABOM_DEFAULT_LOGO_DARK,
  };
}

/**
 * shell-boot 비동기 로드 후에도 로고 URL이 갱신되도록 구독.
 * 커스텀 attachment 는 preload 성공 시에만 src 를 바꿔 엑박을 방지한다.
 */
export function useMoabomSiteLogoUrls(): MoabomSiteBrandingUrls {
  const [urls, setUrls] = useState<MoabomSiteBrandingUrls>(() => resolveMoabomSiteLogoDisplayUrls());

  useEffect(() => {
    let cancelled = false;

    const refresh = (): void => {
      const displayUrls = resolveMoabomSiteLogoDisplayUrls();
      setUrls(displayUrls);

      void resolveMoabomSiteLogoUrlsWithPreload().then(resolved => {
        if (!cancelled) {
          setUrls(resolved);
        }
      });
    };

    refresh();

    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener(MOABOM_SHELL_BOOT_LOADED_EVENT, refresh);

    return () => {
      cancelled = true;
      window.removeEventListener(MOABOM_SHELL_BOOT_LOADED_EVENT, refresh);
    };
  }, []);

  return urls;
}
