const DEFAULT_MANIFEST_HREF = '/api/plugins/moabom-pwa/manifest.webmanifest';
const ICON_URL_PREFIX = '/api/templates/assets/moabom-basic/pwa/icons';
const MANIFEST_LINK_ID = 'moabom-pwa-manifest';

export interface InstallManifestLinkOptions {
  href?: string;
}

function upsertLink(id: string, attributes: Record<string, string>): HTMLLinkElement {
  const existing = document.getElementById(id) as HTMLLinkElement | null;
  const link = existing ?? document.createElement('link');
  link.id = id;

  for (const [name, value] of Object.entries(attributes)) {
    link.setAttribute(name, value);
  }

  if (!existing) {
    document.head.appendChild(link);
  }

  return link;
}

/**
 * 사용자 템플릿 head에 PWA manifest 링크를 1회 설치합니다.
 */
export function installMoabomPwaManifestLink(options: InstallManifestLinkOptions = {}): HTMLLinkElement | null {
  if (typeof document === 'undefined') return null;

  const href = options.href ?? DEFAULT_MANIFEST_HREF;
  const existing = document.querySelector<HTMLLinkElement>(`link[rel="manifest"][href="${href}"]`)
    ?? document.getElementById(MANIFEST_LINK_ID) as HTMLLinkElement | null;

  if (existing) {
    existing.rel = 'manifest';
    existing.href = href;
    existing.id = MANIFEST_LINK_ID;
    return existing;
  }

  const link = document.createElement('link');
  link.id = MANIFEST_LINK_ID;
  link.rel = 'manifest';
  link.href = href;
  document.head.appendChild(link);

  return link;
}

/**
 * 브라우저 기본 아이콘 탐색이 legacy 경로(`/abc/icon/*`)로 빠지지 않도록
 * 사용자 템플릿의 공개 PWA 아이콘 엔드포인트를 head에 명시합니다.
 */
export function installMoabomPwaIconLinks(): void {
  if (typeof document === 'undefined') return;

  upsertLink('moabom-apple-touch-icon', {
    rel: 'apple-touch-icon',
    sizes: '180x180',
    href: `${ICON_URL_PREFIX}/apple-touch-icon-180.png`,
  });

  upsertLink('moabom-favicon-32', {
    rel: 'icon',
    type: 'image/png',
    sizes: '32x32',
    href: `${ICON_URL_PREFIX}/favicon-32.png`,
  });

  upsertLink('moabom-favicon-16', {
    rel: 'icon',
    type: 'image/png',
    sizes: '16x16',
    href: `${ICON_URL_PREFIX}/favicon-16.png`,
  });
}
