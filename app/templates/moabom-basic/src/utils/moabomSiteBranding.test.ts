import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MOABOM_DEFAULT_LOGO_LIGHT,
  isMoabomCustomAttachmentLogoUrl,
  preloadMoabomSiteLogoUrl,
  resolveMoabomSiteLogoFallbackUrl,
} from './moabomSiteBranding';

type MockImage = {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
};

describe('moabomSiteBranding', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attachment 로고 URL 을 식별한다', () => {
    expect(isMoabomCustomAttachmentLogoUrl('/api/attachment/IjuTw5Vp8Syr')).toBe(true);
    expect(isMoabomCustomAttachmentLogoUrl(MOABOM_DEFAULT_LOGO_LIGHT)).toBe(false);
  });

  it('preloadMoabomSiteLogoUrl — 번들 asset 은 그대로 반환한다', async () => {
    const imageSpy = vi.spyOn(globalThis, 'Image');

    await expect(
      preloadMoabomSiteLogoUrl(MOABOM_DEFAULT_LOGO_LIGHT, MOABOM_DEFAULT_LOGO_LIGHT),
    ).resolves.toBe(MOABOM_DEFAULT_LOGO_LIGHT);

    expect(imageSpy).not.toHaveBeenCalled();
  });

  it('preloadMoabomSiteLogoUrl — attachment 성공 시 원본 URL 을 반환한다', async () => {
    const instances: MockImage[] = [];

    vi.stubGlobal(
      'Image',
      vi.fn(() => {
        const image: MockImage = {
          onload: null,
          onerror: null,
          src: '',
        };
        instances.push(image);
        return image;
      }),
    );

    const promise = preloadMoabomSiteLogoUrl(
      '/api/attachment/abc',
      MOABOM_DEFAULT_LOGO_LIGHT,
    );

    expect(instances).toHaveLength(1);
    instances[0]!.onload?.();
    await expect(promise).resolves.toBe('/api/attachment/abc');
  });

  it('preloadMoabomSiteLogoUrl — 1회 재시도 후 폴백한다', async () => {
    const instances: MockImage[] = [];

    vi.stubGlobal(
      'Image',
      vi.fn(() => {
        const image: MockImage = {
          onload: null,
          onerror: null,
          src: '',
        };
        instances.push(image);
        return image;
      }),
    );

    const promise = preloadMoabomSiteLogoUrl(
      '/api/attachment/abc',
      MOABOM_DEFAULT_LOGO_LIGHT,
    );

    instances[0]!.onerror?.();
    instances[1]!.onerror?.();

    await expect(promise).resolves.toBe(MOABOM_DEFAULT_LOGO_LIGHT);
    expect(instances[1]!.src).toBe('/api/attachment/abc?retry=1');
  });

  it('resolveMoabomSiteLogoFallbackUrl — 모드별 기본 SVG', () => {
    expect(resolveMoabomSiteLogoFallbackUrl('light')).toContain('logo_smartcare.svg');
    expect(resolveMoabomSiteLogoFallbackUrl('dark')).toContain('logo_smartcare_w.svg');
  });
});
