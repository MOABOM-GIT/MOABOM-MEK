import { useEffect, useState } from 'react';
import { getMoabomShellBootData } from '../runtime/moabomShellBoot';
import { MOABOM_SHELL_BOOT_LOADED_EVENT } from '../i18n/moabomShellEvents';

export const MOABOM_DEFAULT_LOGO_LIGHT =
  '/api/templates/assets/moabom-basic/img/logo_smartcare.svg';

export const MOABOM_DEFAULT_LOGO_DARK =
  '/api/templates/assets/moabom-basic/img/logo_smartcare_w.svg';

export type MoabomSiteBrandingUrls = {
  lightUrl: string;
  darkUrl: string;
};

/** 플랫폼(mek360.com) 우측 패널 기본 브랜드명 */
export const MOABOM_PLATFORM_DISPLAY_NAME = '스마트케어360';

/** shell-boot site_name — 테넌트 병원명, 플랫폼(mek360)은 스마트케어360 */
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
 * (초기 렌더만 resolveMoabomSiteLogoUrls() 호출 시 SMARTCARE 폴백에 고정되는 레이스 방지)
 */
export function useMoabomSiteLogoUrls(): MoabomSiteBrandingUrls {
  const [urls, setUrls] = useState<MoabomSiteBrandingUrls>(() => resolveMoabomSiteLogoUrls());

  useEffect(() => {
    const refresh = (): void => setUrls(resolveMoabomSiteLogoUrls());
    refresh();

    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener(MOABOM_SHELL_BOOT_LOADED_EVENT, refresh);

    return () => window.removeEventListener(MOABOM_SHELL_BOOT_LOADED_EVENT, refresh);
  }, []);

  return urls;
}
