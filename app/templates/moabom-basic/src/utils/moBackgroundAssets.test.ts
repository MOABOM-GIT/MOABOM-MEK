import { describe, expect, it } from 'vitest';
import {
  clampMoabomBackgroundImageId,
  deriveMoabomBackgroundImageChoicesByMode,
  deriveMoabomBackgroundImageChoicesFromAppearance,
  findMoabomBackgroundIdByPointColor,
  isMoabomCustomBackgroundUuid,
  isValidMoabomBackgroundImageId,
  moabomBackgroundImageCssValue,
  moabomThemeToBackgroundMode,
  resolveMoabomBackgroundImageUrl,
  resolveMoabomBackgroundThumbUrl,
} from './moBackgroundAssets';

const SAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_UUID = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';

describe('moBackgroundAssets — upload-only background model', () => {
  it('isMoabomCustomBackgroundUuid: UUIDv4 만 true', () => {
    expect(isMoabomCustomBackgroundUuid(SAMPLE_UUID)).toBe(true);
    expect(isMoabomCustomBackgroundUuid('13')).toBe(false);
    expect(isMoabomCustomBackgroundUuid('')).toBe(false);
    expect(isMoabomCustomBackgroundUuid(null)).toBe(false);
  });

  it('isValidMoabomBackgroundImageId: UUID만 허용, 과거 번들 슬롯·URL 등은 모두 거절', () => {
    expect(isValidMoabomBackgroundImageId(SAMPLE_UUID)).toBe(true);
    expect(isValidMoabomBackgroundImageId('1')).toBe(false);
    expect(isValidMoabomBackgroundImageId('13')).toBe(false);
    expect(isValidMoabomBackgroundImageId('99')).toBe(false);
    expect(isValidMoabomBackgroundImageId('https://example.com/bg.jpg')).toBe(false);
    expect(isValidMoabomBackgroundImageId('')).toBe(false);
    expect(isValidMoabomBackgroundImageId(null)).toBe(false);
  });

  it('deriveMoabomBackgroundImageChoicesFromAppearance: 업로드 UUID 목록만 입력 순서대로 반환', () => {
    const ids = deriveMoabomBackgroundImageChoicesFromAppearance({
      home_background_items: [
        { id: SAMPLE_UUID },
        { id: 'not-a-uuid' },
        { id: OTHER_UUID },
        null,
        undefined,
      ],
    });
    expect(ids).toEqual([SAMPLE_UUID, OTHER_UUID]);
  });

  it('deriveMoabomBackgroundImageChoicesFromAppearance: 업로드가 없으면 빈 배열', () => {
    expect(deriveMoabomBackgroundImageChoicesFromAppearance({})).toEqual([]);
    expect(deriveMoabomBackgroundImageChoicesFromAppearance(undefined)).toEqual([]);
    expect(
      deriveMoabomBackgroundImageChoicesFromAppearance({ home_background_items: [] }),
    ).toEqual([]);
  });

  it('clampMoabomBackgroundImageId: allowlist 내에 있으면 유지, 없으면 첫 항목', () => {
    expect(clampMoabomBackgroundImageId(SAMPLE_UUID, [SAMPLE_UUID, OTHER_UUID])).toBe(SAMPLE_UUID);
    expect(clampMoabomBackgroundImageId(OTHER_UUID, [SAMPLE_UUID])).toBe(SAMPLE_UUID);
    expect(clampMoabomBackgroundImageId('1', [SAMPLE_UUID])).toBe(SAMPLE_UUID);
  });

  it('clampMoabomBackgroundImageId: allowlist가 비어 있으면 빈 문자열', () => {
    expect(clampMoabomBackgroundImageId(SAMPLE_UUID, [])).toBe('');
    expect(clampMoabomBackgroundImageId(undefined, [])).toBe('');
  });

  it('resolveMoabomBackgroundImageUrl: UUID만 API 경로, 나머지는 빈 문자열', () => {
    expect(resolveMoabomBackgroundImageUrl(SAMPLE_UUID)).toBe(
      `/api/modules/moabom-system/home-backgrounds/${SAMPLE_UUID}/full`,
    );
    expect(resolveMoabomBackgroundImageUrl('1')).toBe('');
    expect(resolveMoabomBackgroundImageUrl('https://example.com/bg.jpg')).toBe('');
    expect(resolveMoabomBackgroundImageUrl(undefined)).toBe('');
  });

  it('resolveMoabomBackgroundThumbUrl: UUID만 썸네일 API 경로, 나머지는 빈 문자열', () => {
    expect(resolveMoabomBackgroundThumbUrl(SAMPLE_UUID)).toBe(
      `/api/modules/moabom-system/home-backgrounds/${SAMPLE_UUID}/thumb`,
    );
    expect(resolveMoabomBackgroundThumbUrl('1')).toBe('');
    expect(resolveMoabomBackgroundThumbUrl(undefined)).toBe('');
  });

  it('moabomBackgroundImageCssValue: UUID만 url(), 나머지는 none', () => {
    expect(moabomBackgroundImageCssValue(SAMPLE_UUID)).toBe(
      `url("/api/modules/moabom-system/home-backgrounds/${SAMPLE_UUID}/full")`,
    );
    expect(moabomBackgroundImageCssValue('1')).toBe('none');
    expect(moabomBackgroundImageCssValue(undefined)).toBe('none');
    expect(moabomBackgroundImageCssValue('')).toBe('none');
  });
});


describe('moBackgroundAssets — mode 필터 & 포인트 컬러 바인딩', () => {
  const UUID_LIGHT_A = '00000000-0000-4000-8000-0000000000a1';
  const UUID_LIGHT_B = '00000000-0000-4000-8000-0000000000a2';
  const UUID_DARK_A = '00000000-0000-4000-8000-0000000000b1';
  const UUID_DARK_B = '00000000-0000-4000-8000-0000000000b2';

  const appearance = {
    home_background_items: [
      { id: UUID_LIGHT_A, mode: 'light' as const, point_color: '#6366f1' },
      { id: UUID_LIGHT_B, mode: 'light' as const, point_color: null },
      { id: UUID_DARK_A, mode: 'dark' as const, point_color: '#f657a6' },
      { id: UUID_DARK_B, mode: 'dark' as const, point_color: '#6366f1' },
    ],
  };

  it('moabomThemeToBackgroundMode: flat-* 는 동일 명암 축으로 축약', () => {
    expect(moabomThemeToBackgroundMode('light')).toBe('light');
    expect(moabomThemeToBackgroundMode('flat-light')).toBe('light');
    expect(moabomThemeToBackgroundMode('dark')).toBe('dark');
    expect(moabomThemeToBackgroundMode('flat-dark')).toBe('dark');
    expect(moabomThemeToBackgroundMode(undefined)).toBe('light');
  });

  it('deriveMoabomBackgroundImageChoicesByMode: 현재 모드 항목만 반환', () => {
    expect(deriveMoabomBackgroundImageChoicesByMode(appearance, 'light')).toEqual([
      UUID_LIGHT_A,
      UUID_LIGHT_B,
    ]);
    expect(deriveMoabomBackgroundImageChoicesByMode(appearance, 'dark')).toEqual([
      UUID_DARK_A,
      UUID_DARK_B,
    ]);
  });

  it('deriveMoabomBackgroundImageChoicesByMode: mode 누락 항목은 light 로 간주', () => {
    const legacy = {
      home_background_items: [{ id: UUID_LIGHT_A } /* mode/point_color 없음 */],
    };
    expect(deriveMoabomBackgroundImageChoicesByMode(legacy, 'light')).toEqual([UUID_LIGHT_A]);
    expect(deriveMoabomBackgroundImageChoicesByMode(legacy, 'dark')).toEqual([UUID_LIGHT_A]); // fallback
  });

  it('deriveMoabomBackgroundImageChoicesByMode: 매칭 0 개이면 전체 목록(fallback)', () => {
    const onlyLight = {
      home_background_items: [{ id: UUID_LIGHT_A, mode: 'light' as const }],
    };
    // dark 매칭 없음 → fallback 전체
    expect(deriveMoabomBackgroundImageChoicesByMode(onlyLight, 'dark')).toEqual([UUID_LIGHT_A]);
  });

  it('findMoabomBackgroundIdByPointColor: hex 에 바인딩된 UUID 를 반환', () => {
    expect(findMoabomBackgroundIdByPointColor(appearance, '#f657a6')).toBe(UUID_DARK_A);
  });

  it('findMoabomBackgroundIdByPointColor: preferredMode 우선 선택 — light 모드에서 #6366f1 은 LIGHT_A', () => {
    expect(findMoabomBackgroundIdByPointColor(appearance, '#6366f1', 'light')).toBe(UUID_LIGHT_A);
  });

  it('findMoabomBackgroundIdByPointColor: preferredMode 에 없으면 다른 모드 매칭으로 폴백', () => {
    const onlyDark = {
      home_background_items: [{ id: UUID_DARK_A, mode: 'dark' as const, point_color: '#f657a6' }],
    };
    expect(findMoabomBackgroundIdByPointColor(onlyDark, '#f657a6', 'light')).toBe(UUID_DARK_A);
  });

  it('findMoabomBackgroundIdByPointColor: hex 가 아무에게도 바인딩 안 돼 있으면 null', () => {
    expect(findMoabomBackgroundIdByPointColor(appearance, '#000000')).toBeNull();
  });

  it('findMoabomBackgroundIdByPointColor: 잘못된 hex 형식이면 null', () => {
    expect(findMoabomBackgroundIdByPointColor(appearance, 'not-a-color')).toBeNull();
  });

  it('findMoabomBackgroundIdByPointColor: 대소문자 무관 (#FF0000 ↔ #ff0000)', () => {
    const caseVariant = {
      home_background_items: [{ id: UUID_LIGHT_A, mode: 'light' as const, point_color: '#FF0000' }],
    };
    expect(findMoabomBackgroundIdByPointColor(caseVariant, '#ff0000')).toBe(UUID_LIGHT_A);
  });
});
