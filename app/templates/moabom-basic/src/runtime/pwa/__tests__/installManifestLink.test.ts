import { afterEach, describe, expect, it } from 'vitest';

import { installMoabomPwaIconLinks, installMoabomPwaManifestLink } from '../installManifestLink';

describe('installMoabomPwaManifestLink', () => {
  afterEach(() => {
    document.head.querySelectorAll('link[rel="manifest"],link[rel="apple-touch-icon"],link[rel="icon"]').forEach((node) => node.remove());
  });

  it('기본 PWA manifest 링크를 head에 설치한다', () => {
    const link = installMoabomPwaManifestLink();

    expect(link).not.toBeNull();
    expect(link?.rel).toBe('manifest');
    expect(link?.getAttribute('href')).toBe('/api/plugins/moabom-pwa/manifest.webmanifest');
    expect(document.head.querySelectorAll('link[rel="manifest"]')).toHaveLength(1);
  });

  it('여러 번 호출되어도 manifest 링크를 중복 삽입하지 않는다', () => {
    const first = installMoabomPwaManifestLink();
    const second = installMoabomPwaManifestLink();

    expect(second).toBe(first);
    expect(document.head.querySelectorAll('link[rel="manifest"]')).toHaveLength(1);
  });

  it('동일 href의 기존 manifest 링크가 있으면 재사용한다', () => {
    const existing = document.createElement('link');
    existing.rel = 'manifest';
    existing.href = '/api/plugins/moabom-pwa/manifest.webmanifest';
    document.head.appendChild(existing);

    const link = installMoabomPwaManifestLink();

    expect(link).toBe(existing);
    expect(link?.id).toBe('moabom-pwa-manifest');
    expect(document.head.querySelectorAll('link[rel="manifest"]')).toHaveLength(1);
  });

  it('Apple touch icon과 favicon 링크를 PWA 아이콘 API 경로로 설치한다', () => {
    installMoabomPwaIconLinks();
    installMoabomPwaIconLinks();

    const apple = document.getElementById('moabom-apple-touch-icon') as HTMLLinkElement | null;
    const favicon32 = document.getElementById('moabom-favicon-32') as HTMLLinkElement | null;
    const favicon16 = document.getElementById('moabom-favicon-16') as HTMLLinkElement | null;

    expect(apple?.getAttribute('href')).toBe('/api/templates/assets/moabom-basic/pwa/icons/apple-touch-icon-180.png');
    expect(apple?.getAttribute('sizes')).toBe('180x180');
    expect(favicon32?.getAttribute('href')).toBe('/api/templates/assets/moabom-basic/pwa/icons/favicon-32.png');
    expect(favicon16?.getAttribute('href')).toBe('/api/templates/assets/moabom-basic/pwa/icons/favicon-16.png');
    expect(document.head.querySelectorAll('link[rel="apple-touch-icon"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('link[rel="icon"]')).toHaveLength(2);
  });
});
