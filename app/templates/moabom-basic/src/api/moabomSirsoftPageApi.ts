/**
 * sirsoft-page 모듈 공개 페이지 API (비로그인 조회 가능)
 *
 * @see modules/sirsoft-page/src/routes/api.php
 */

interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

export interface PublishedSirsoftPagePayload {
  id: number;
  slug: string;
  title: string;
  content: string;
  content_mode?: string;
}

/**
 * 발행된 페이지를 슬러그로 조회합니다.
 *
 * @throws Error 네트워크·404·비발행 등
 */
function legalPageApiPath(pageSlug: string): string {
  if (pageSlug === 'terms' || pageSlug === 'privacy') {
    return `/api/modules/moabom-system/public/legal-pages/${encodeURIComponent(pageSlug)}`;
  }

  return `/api/modules/sirsoft-page/pages/${encodeURIComponent(pageSlug)}`;
}

/** 약관·개인정보 — moabom-system(tenant + platform DB fallback). 그 외 slug 는 sirsoft-page. */
export async function fetchPublishedSirsoftPage(slug: string): Promise<PublishedSirsoftPagePayload> {
  const path = legalPageApiPath(slug);
  const response = await fetch(path, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  });

  const payload = (await response.json()) as ApiEnvelope<PublishedSirsoftPagePayload>;

  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.message || '페이지를 불러오지 못했습니다.');
  }

  return payload.data;
}
