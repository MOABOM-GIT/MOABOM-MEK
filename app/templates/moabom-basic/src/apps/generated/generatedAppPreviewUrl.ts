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

/** cross-origin 프리뷰(apps.mek360.com) 시 sandbox에 same-origin 필요 */
export function generatedAppPreviewSandbox(previewUrl: string | null): string {
  if (!previewUrl) {
    return 'allow-scripts';
  }

  try {
    const origin = new URL(previewUrl, window.location.origin).origin;
    if (origin !== window.location.origin) {
      return 'allow-scripts allow-same-origin';
    }
  } catch {
    // ignore
  }

  return 'allow-scripts';
}
