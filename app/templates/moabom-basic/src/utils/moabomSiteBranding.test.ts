import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MOABOM_DEFAULT_LOGO_LIGHT,
  isMoabomCustomAttachmentLogoUrl,
  preloadMoabomSiteLogoUrl,
  resolveMoabomSiteLogoFallbackUrl,
  resolveMoabomSiteLogoImgRecoveryUrl,
  withMoabomBundledLogoCacheVersion,
} from './moabomSiteBranding';

type MockImage = {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
};

function stubImageLoader(): MockImage[] {
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

  return instances;
}

describe('moabomSiteBranding', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('attachment 로고 URL 을 식별한다', () => {
    expect(isMoabomCustomAttachmentLogoUrl('/api/attachment/IjuTw5Vp8Syr')).toBe(true);
    expect(isMoabomCustomAttachmentLogoUrl(MOABOM_DEFAULT_LOGO_LIGHT)).toBe(false);
  });

  it('withMoabomBundledLogoCacheVersion — extensionCacheVersion 쿼리를 붙인다', () => {
    (globalThis as unknown as { G7Core?: { extensionCacheVersion?: number } }).G7Core = {
      extensionCacheVersion: 42,
    };

    expect(withMoabomBundledLogoCacheVersion(MOABOM_DEFAULT_LOGO_LIGHT)).toBe(
      `${MOABOM_DEFAULT_LOGO_LIGHT}?v=42`,
    );
  });

  it('preloadMoabomSiteLogoUrl — 번들 asset 은 preload 성공 시 버전 URL을 반환한다', async () => {
    (globalThis as unknown as { G7Core?: { extensionCacheVersion?: number } }).G7Core = {
      extensionCacheVersion: 7,
    };
    const instances = stubImageLoader();

    const promise = preloadMoabomSiteLogoUrl(
      MOABOM_DEFAULT_LOGO_LIGHT,
      MOABOM_DEFAULT_LOGO_LIGHT,
    );

    expect(instances).toHaveLength(1);
    instances[0]!.onload?.();

    await expect(promise).resolves.toBe(`${MOABOM_DEFAULT_LOGO_LIGHT}?v=7`);
  });

  it('preloadMoabomSiteLogoUrl — 번들 asset 실패 시 retry 쿼리로 재시도한다', async () => {
    (globalThis as unknown as { G7Core?: { extensionCacheVersion?: number } }).G7Core = {
      extensionCacheVersion: 7,
    };
    const instances = stubImageLoader();

    const promise = preloadMoabomSiteLogoUrl(
      MOABOM_DEFAULT_LOGO_LIGHT,
      MOABOM_DEFAULT_LOGO_LIGHT,
    );

    instances[0]!.onerror?.();
    instances[1]!.onload?.();

    await expect(promise).resolves.toBe(`${MOABOM_DEFAULT_LOGO_LIGHT}?v=7&retry=1`);
  });

  it('preloadMoabomSiteLogoUrl — attachment 성공 시 원본 URL 을 반환한다', async () => {
    const instances = stubImageLoader();

    const promise = preloadMoabomSiteLogoUrl(
      '/api/attachment/abc',
      MOABOM_DEFAULT_LOGO_LIGHT,
    );

    expect(instances).toHaveLength(1);
    instances[0]!.onload?.();
    await expect(promise).resolves.toBe('/api/attachment/abc');
  });

  it('preloadMoabomSiteLogoUrl — attachment 1회 재시도 후 폴백한다', async () => {
    const instances = stubImageLoader();

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

  it('resolveMoabomSiteLogoImgRecoveryUrl — 동일 폴백 src 는 retry 쿼리로 복구', () => {
    (globalThis as unknown as { G7Core?: { extensionCacheVersion?: number } }).G7Core = {
      extensionCacheVersion: 3,
    };
    const fallback = resolveMoabomSiteLogoFallbackUrl('light');

    expect(resolveMoabomSiteLogoImgRecoveryUrl(fallback, 'light')).toBe(`${fallback}&retry=1`);
  });

  it('resolveMoabomSiteLogoImgRecoveryUrl — 커스텀 src 실패 시 폴백으로 복구', () => {
    const fallback = resolveMoabomSiteLogoFallbackUrl('dark');

    expect(resolveMoabomSiteLogoImgRecoveryUrl('/api/attachment/x', 'dark')).toBe(fallback);
  });
});
