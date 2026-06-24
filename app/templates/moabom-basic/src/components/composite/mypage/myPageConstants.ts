import type { MyPageTab, TabDefinition } from './myPageTypes';

/** 아이콘만 유지 — 라벨·설명은 `moa_mypage.tabs.{id}` 번역 키 사용 */
export const TAB_DEFINITIONS: TabDefinition[] = [
  { id: 'profile', icon: 'user' },
  { id: 'settings', icon: 'cog' },
  { id: 'credit', icon: 'gem' },
  { id: 'library', icon: 'folder-open' },
  { id: 'activity', icon: 'clock' },
  { id: 'account', icon: 'lock' },
  { id: 'subscription', icon: 'check-circle' },
];

/** 라우트·persist 검증용 탭 id 목록 SSOT */
export const MY_PAGE_TABS: readonly MyPageTab[] = TAB_DEFINITIONS.map(tab => tab.id);

/** @deprecated TAB_DEFINITIONS + 번역 사용 */
export const TABS = TAB_DEFINITIONS;

export const GUEST_ENABLED_TABS: MyPageTab[] = ['settings', 'library'];

export const POINT_COLOR = 'var(--moa-point-color)';

/** 환경설정 기본 포인트 컬러 (hex + 레이블 키 presetId는 `moa_mypage.settings_ui.point_preset.*`) */
export type PointColorPresetItem = { presetId: string | null; hex: string };

export const DEFAULT_POINT_COLOR_PRESET_ITEMS: readonly PointColorPresetItem[] = [
  { presetId: 'main', hex: '#6366f1' },
  { presetId: 'naver', hex: '#03a94d' },
  { presetId: 'reference', hex: '#20cff4' },
  { presetId: 'sky', hex: '#3b82f6' },
  { presetId: 'cyan', hex: '#17c0e4' },
  { presetId: 'orange', hex: '#f69c0f' },
  { presetId: 'pink', hex: '#f657a6' },
  { presetId: 'red', hex: '#f05d5d' },
  { presetId: 'dark_blue', hex: '#3a5476' },
];

/** 서버/구코드 폴백용 hex 배열만 필요할 때 */
export const DEFAULT_POINT_COLOR_PRESETS: readonly string[] = DEFAULT_POINT_COLOR_PRESET_ITEMS.map(
  item => item.hex,
);

export function derivePointPresetChoices(hexList: string[] | undefined | null): PointColorPresetItem[] {
  if (hexList?.length) {
    return hexList.map(hex => ({ presetId: null, hex }));
  }
  return [...DEFAULT_POINT_COLOR_PRESET_ITEMS];
}

/** SNS 내부용 임시 이메일 접미사 (moabom-social-auth 와 동일) */
export const SYNTHETIC_EMAIL_SUFFIX = '@social-auth.invalid';

export const ACTIVITY_FILTER_IDS = ['all', 'posts', 'comments', 'interactions'] as const;
