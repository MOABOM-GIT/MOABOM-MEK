/**
 * Moabom 셸 홈 배경 이미지 유틸.
 *
 * 배경 후보는 **관리자가 업로드한 홈 배경(`home_background_items[].id` — UUIDv4)** 만 사용한다.
 * 기존 템플릿 번들 배경(1~13)과 해석 로직은 모두 제거했다.
 *
 * 업로드 배경 URL:
 *   - Full : `/api/modules/moabom-system/home-backgrounds/{uuid}/full`
 *   - Thumb: `/api/modules/moabom-system/home-backgrounds/{uuid}/thumb`
 */

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isMoabomCustomBackgroundUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4_RE.test(value);
}

/**
 * 홈 배경 id 값으로 유효한지(= 업로드 UUID 여야 한다).
 * 과거 템플릿 번들 슬롯(1~13)은 더 이상 허용하지 않는다.
 */
export function isValidMoabomBackgroundImageId(value: unknown): value is string {
  return isMoabomCustomBackgroundUuid(value);
}

export function moabomUploadedBackgroundUrl(backgroundId: string, variant: 'full' | 'thumb' = 'full'): string {
  return `/api/modules/moabom-system/home-backgrounds/${backgroundId}/${variant}`;
}

export type MoabomHomeBackgroundMode = 'light' | 'dark';

export interface MoabomHomeBackgroundEntry {
  id?: string;
  mode?: MoabomHomeBackgroundMode;
  point_color?: string | null;
}

export interface MoabomAppearanceBackgroundConfig {
  home_background_items?: Array<MoabomHomeBackgroundEntry | null | undefined>;
}

/** 관리자가 업로드한 배경 UUID 목록만 반환한다(입력 순서 유지). */
export function deriveMoabomBackgroundImageChoicesFromAppearance(
  appearance: MoabomAppearanceBackgroundConfig | undefined,
): readonly string[] {
  const src = appearance ?? {};
  return (src.home_background_items ?? [])
    .map(item => item?.id)
    .filter((id): id is string => isMoabomCustomBackgroundUuid(id));
}

/**
 * 현재 테마 모드에 일치하는 배경 UUID 목록만 반환한다(입력 순서 유지).
 *
 * 일치하는 항목이 0 개이면 **fallback 으로 전체 배경 목록**을 그대로 반환한다
 * (사용자가 모드를 바꿨을 때 빈 그리드로 남지 않도록).
 */
export function deriveMoabomBackgroundImageChoicesByMode(
  appearance: MoabomAppearanceBackgroundConfig | undefined,
  mode: MoabomHomeBackgroundMode,
): readonly string[] {
  const src = appearance ?? {};
  const items = src.home_background_items ?? [];
  const filtered = items
    .filter((item): item is MoabomHomeBackgroundEntry => !!item)
    .filter(item => (item.mode ?? 'light') === mode)
    .map(item => item.id)
    .filter((id): id is string => isMoabomCustomBackgroundUuid(id));

  if (filtered.length > 0) {
    return filtered;
  }
  // fallback: 모드와 무관하게 전체 목록
  return deriveMoabomBackgroundImageChoicesFromAppearance(appearance);
}

/**
 * 포인트 컬러 hex 에 바인딩된 배경 UUID 를 찾는다.
 *
 * 우선순위: 사용자가 현재 모드인 배경 > 다른 모드 배경.
 * (현재 모드에 바인딩된 배경이 있으면 그것을 반환, 없으면 다른 모드에서 바인딩된 배경이라도 반환)
 *
 * 아무 배경에도 바인딩돼 있지 않으면 `null`.
 */
export function findMoabomBackgroundIdByPointColor(
  appearance: MoabomAppearanceBackgroundConfig | undefined,
  pointColorHex: string,
  preferredMode?: MoabomHomeBackgroundMode,
): string | null {
  const target = normalizeHex6(pointColorHex);
  if (!target) return null;
  const items = appearance?.home_background_items ?? [];

  let fallback: string | null = null;
  for (const item of items) {
    if (!item) continue;
    const hex = typeof item.point_color === 'string' ? normalizeHex6(item.point_color) : null;
    if (hex !== target) continue;
    if (!isMoabomCustomBackgroundUuid(item.id)) continue;

    if (preferredMode && (item.mode ?? 'light') === preferredMode) {
      return item.id;
    }
    if (fallback === null) {
      fallback = item.id;
    }
  }
  return fallback;
}

/**
 * 사용자 테마(`light`/`dark`/`flat-light`/`flat-dark`) 에서 배경 필터에 쓸 모드로 축약한다.
 * 성능 테마(flat-*) 도 명암 축과 동일하게 취급한다.
 */
export function moabomThemeToBackgroundMode(
  theme: 'light' | 'dark' | 'flat-light' | 'flat-dark' | undefined,
): MoabomHomeBackgroundMode {
  if (theme === 'dark' || theme === 'flat-dark') {
    return 'dark';
  }
  return 'light';
}

/** 선택 id가 업로드 목록에 없으면 목록 첫 항목으로 보정, 없으면 빈 문자열. */
export function clampMoabomBackgroundImageId(
  backgroundImageId: string | undefined,
  allowlist: readonly string[],
): string {
  const candidate = isValidMoabomBackgroundImageId(backgroundImageId) ? backgroundImageId : '';
  if (candidate && allowlist.includes(candidate)) {
    return candidate;
  }
  return allowlist[0] ?? '';
}

/** `#rrggbb` 정규화(소문자), 아니면 null */
function normalizeHex6(value: string): string | null {
  const s = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) {
    return s.toLowerCase();
  }
  return null;
}

/**
 * 관리자가 정한 프리셋 hex 목록에 사용자 색이 없으면 플랫폼 기본 포인트(또는 첫 프리셋)으로 보정합니다.
 * 프리셋이 비어 있으면 사용자 값을 그대로 유지합니다(레거시 호환).
 */
export function clampMoabomPointColorToAdminPresets(
  pointColor: string | undefined,
  presets: string[] | undefined,
  defaultPointColor: string | undefined,
): string {
  const hex = typeof pointColor === 'string' ? normalizeHex6(pointColor) : null;
  const list = (presets ?? [])
    .map(p => (typeof p === 'string' ? normalizeHex6(p) : null))
    .filter((x): x is string => x !== null);

  if (list.length === 0) {
    return hex ?? (typeof defaultPointColor === 'string' ? normalizeHex6(defaultPointColor) : null) ?? '#6366f1';
  }

  const fallbackHex = (() => {
    const d = typeof defaultPointColor === 'string' ? normalizeHex6(defaultPointColor) : null;
    if (d && list.includes(d)) {
      return d;
    }
    return list[0] ?? '#6366f1';
  })();

  if (!hex) {
    return fallbackHex;
  }
  if (list.includes(hex)) {
    return hex;
  }
  return fallbackHex;
}

/** 전체 화면 배경용 URL. 업로드 UUID 이외의 값은 빈 문자열을 반환한다. */
export function resolveMoabomBackgroundImageUrl(backgroundImageId: string | undefined): string {
  if (isMoabomCustomBackgroundUuid(backgroundImageId)) {
    return moabomUploadedBackgroundUrl(backgroundImageId, 'full');
  }
  return '';
}

/** 썸네일·격자 미리보기용 URL. 업로드 UUID 이외의 값은 빈 문자열을 반환한다. */
export function resolveMoabomBackgroundThumbUrl(backgroundImageId: string | undefined): string {
  if (isMoabomCustomBackgroundUuid(backgroundImageId)) {
    return moabomUploadedBackgroundUrl(backgroundImageId, 'thumb');
  }
  return '';
}

/**
 * CSS `background-image` 값. 업로드 UUID 이외의 값은 `none` 을 반환해
 * 호출부가 기본 배경색을 유지할 수 있게 한다.
 */
export function moabomBackgroundImageCssValue(backgroundImageId: string | undefined): string {
  const url = resolveMoabomBackgroundImageUrl(backgroundImageId);
  if (!url) {
    return 'none';
  }
  return `url("${url.replace(/"/g, '\\"')}")`;
}
