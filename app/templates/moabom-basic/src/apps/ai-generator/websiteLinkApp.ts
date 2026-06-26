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
