import { buildWebsiteLinkGradientFromPointColor } from '../generated/generatedAppIconFromTitle';

export function normalizeWebsiteUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * API `html` min:20 충족용 플레이스홀더.
 * 실행 시 iframe src 는 metadata.website_url (GeneratedAppViewer) — 래퍼 HTML 미사용.
 */
export function buildWebsiteLinkStoredHtml(title: string): string {
  const safeTitle = escapeHtml(title.trim() || 'Website');

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>${safeTitle}</title></head><body data-moabom-website-link="1"></body></html>`;
}

/** 구 저장본(iframe 래퍼 HTML)에서 URL 추출 — metadata 없을 때만 폴백 */
export function readWebsiteUrlFromStoredHtml(html: string | undefined | null): string {
  if (!html) {
    return '';
  }

  const match = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  return match?.[1]?.trim() ?? '';
}

export function isWebsiteLinkAppType(appType: string | undefined | null): boolean {
  return appType === 'website_link';
}

export const WEBSITE_LINK_APP_GRADIENT = 'linear-gradient(135deg,#f8fafc,#e2e8f0)';

export function readWebsiteUrlFromMetadata(metadata: Record<string, unknown> | undefined | null): string {
  if (!metadata) {
    return '';
  }

  const websiteUrl = metadata.website_url;
  return typeof websiteUrl === 'string' ? websiteUrl.trim() : '';
}

export function readWebsiteIconFromMetadata(metadata: Record<string, unknown> | undefined | null): string {
  if (!metadata) {
    return '';
  }

  const iconUrl = metadata.icon_url ?? metadata.iconImageUrl;
  return typeof iconUrl === 'string' ? iconUrl.trim() : '';
}

export function isInternalWebsiteIconUrl(url: string, appId?: number | null): boolean {
  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.includes('/website-icon')) {
    return true;
  }

  if (appId != null && appId > 0) {
    return trimmed.includes(`/apps/generated/${appId}/website-icon`);
  }

  return /\/apps\/generated\/\d+\/website-icon/.test(trimmed);
}

/** 저장 API용 — 내부 서빙 URL이 아닌 외부 파비콘 원본 URL */
export function readWebsiteIconSourceFromMetadata(
  metadata: Record<string, unknown> | undefined | null,
  appId?: number | null,
): string {
  if (!metadata) {
    return '';
  }

  const iconSource = metadata.icon_source_url;
  if (typeof iconSource === 'string') {
    const trimmed = iconSource.trim();
    if (trimmed && !isInternalWebsiteIconUrl(trimmed, appId)) {
      return trimmed;
    }
  }

  const iconUrl = readWebsiteIconFromMetadata(metadata);
  if (iconUrl && !isInternalWebsiteIconUrl(iconUrl, appId)) {
    return iconUrl;
  }

  return '';
}

export function buildWebsiteLinkSaveMetadata(input: {
  websiteUrl: string;
  resolvedIconUrl: string;
  themeColor: string;
  iconFromTitle: boolean;
  appId?: number | null;
}): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    website_url: input.websiteUrl,
    icon_from_title: input.iconFromTitle,
  };

  const themeColor = input.themeColor.trim();
  if (themeColor) {
    metadata.theme_color = themeColor;
  }

  const externalSource = readWebsiteIconSourceFromMetadata(
    {
      icon_source_url: input.iconFromTitle ? undefined : input.resolvedIconUrl,
      icon_url: input.iconFromTitle ? undefined : input.resolvedIconUrl,
    },
    input.appId,
  );
  if (externalSource) {
    metadata.icon_source_url = externalSource;
  }

  return metadata;
}

/** 저장 시 merge 잔존을 막기 위해 서버 SSOT 아이콘 필드를 제거합니다. */
export function stripWebsiteLinkIconServingMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...metadata };
  delete next.icon_url;
  delete next.stored_icon_path;
  delete next.icon_mime;
  delete next.iconImageUrl;
  return next;
}

/** 저장 API 응답 metadata → 생성기 미리보기 상태 동기화 */
export function readWebsiteLinkPreviewFromMetadata(
  metadata: Record<string, unknown> | undefined | null,
): {
  iconUrl: string;
  iconFromTitle: boolean;
  themeColor: string;
} {
  return {
    iconUrl: readWebsiteIconFromMetadata(metadata),
    iconFromTitle: isWebsiteTitleIconFromMetadata(metadata),
    themeColor: readWebsitePointColorFromMetadata(metadata),
  };
}

export function readWebsitePointColorFromMetadata(metadata: Record<string, unknown> | undefined | null): string {
  if (!metadata) {
    return '';
  }

  const color = metadata.theme_color ?? metadata.website_point_color;
  return typeof color === 'string' ? color.trim() : '';
}

/** 파비콘 없음 → 타이틀 기반 FA 아이콘 + 포인트 컬러 타일 */
export function isWebsiteTitleIconFromMetadata(metadata: Record<string, unknown> | undefined | null): boolean {
  if (!metadata) {
    return false;
  }

  return metadata.icon_from_title === true;
}

export function resolveWebsiteLinkAppGradient(
  metadata: Record<string, unknown> | undefined | null,
  hasIconImage: boolean,
): string {
  if (hasIconImage) {
    return WEBSITE_LINK_APP_GRADIENT;
  }

  if (isWebsiteTitleIconFromMetadata(metadata)) {
    return buildWebsiteLinkGradientFromPointColor(readWebsitePointColorFromMetadata(metadata));
  }

  return WEBSITE_LINK_APP_GRADIENT;
}
