import {
  isWebsiteLinkAppType,
  normalizeWebsiteUrl,
  readWebsiteUrlFromMetadata,
  readWebsiteUrlFromStoredHtml,
} from '../ai-generator/websiteLinkApp';

export type AppTier = 'standard' | 'hosted';

export interface GeneratedAppPreviewFields {
  tier?: AppTier;
  preview_url?: string | null;
  hosted_subdomain?: string | null;
}

export const GENERATED_APP_PREVIEW_PATH_PREFIX = '/modules/moabom-apps/preview';

/**
 * API `preview_url` 우선. 미제공 시 로컬 경로 폴백.
 */
export function resolveGeneratedAppPreviewUrl(app: { id: number } & GeneratedAppPreviewFields): string | null {
  if (app.preview_url) {
    return app.preview_url;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const base = `${window.location.origin}${GENERATED_APP_PREVIEW_PATH_PREFIX}`;
  if (app.tier === 'hosted') {
    return `${base}/hosted/${app.id}`;
  }

  return `${base}/g/${app.id}`;
}

/**
 * 셸 iframe `src` — 웹사이트 연결은 metadata URL 직접, 그 외는 프리뷰 호스트.
 */
export function resolveGeneratedAppFrameUrl(
  app: {
    id: number;
    app_type?: string;
    html?: string | null;
    metadata?: Record<string, unknown> | null;
  } & GeneratedAppPreviewFields,
): string | null {
  if (isWebsiteLinkAppType(app.app_type)) {
    const fromMetadata = readWebsiteUrlFromMetadata(app.metadata);
    const raw = fromMetadata || readWebsiteUrlFromStoredHtml(app.html);
    return raw ? normalizeWebsiteUrl(raw) : null;
  }

  return resolveGeneratedAppPreviewUrl(app);
}

/** cross-origin 프리뷰(apps.mek360.com) 시 sandbox에 same-origin 필요 */
export function generatedAppPreviewSandbox(previewUrl: string | null): string {
  if (!previewUrl) {
    return 'allow-scripts';
  }

  try {
    const origin = new URL(previewUrl, window.location.origin).origin;
    if (origin !== window.location.origin) {
      return 'allow-scripts allow-same-origin allow-downloads';
    }
  } catch {
    // ignore
  }

  return 'allow-scripts';
}

/**
 * 외부 HTTPS 웹사이트 연결 iframe sandbox.
 * cross-origin 이므로 Moabom 셸 DOM/쿠키 접근 불가 — 사이트 자체 cookie·storage·위젯 동작만 허용.
 */
export const WEBSITE_LINK_FRAME_SANDBOX =
  'allow-scripts allow-forms allow-popups allow-same-origin';

/** 외부 웹사이트 연결 vs AI 프리뷰 호스트 */
export function generatedAppFrameSandbox(frameUrl: string | null, appType?: string | null): string {
  if (isWebsiteLinkAppType(appType)) {
    return WEBSITE_LINK_FRAME_SANDBOX;
  }

  return generatedAppPreviewSandbox(frameUrl);
}
