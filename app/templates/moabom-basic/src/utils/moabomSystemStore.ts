import { isMoabomUiLanguage } from './moabomLocaleCatalog';
import type {
  MoabomFontSizeLevel,
  MoabomSystemAppearance,
  MoabomSystemCenterMode,
  MoabomSystemDefaults,
  MoabomSystemLanguage,
  MoabomSystemOptions,
  MoabomSystemState,
  MoabomSystemStateMergePatch,
  MoabomSystemTheme,
} from '../types/moabomSystem';
import {
  isValidMoabomBackgroundImageId,
  moabomBackgroundImageCssValue,
} from './moBackgroundAssets';

export const MOABOM_SYSTEM_STORAGE_KEY = 'moabom_system';

/** 같은 탭에서 `saveMoabomSystemState` 후 UI 동기화용 */
export const MOABOM_SYSTEM_STATE_CHANGED_EVENT = 'moabom-system-state-changed';

/** 글자 크기 단계 범위·기본값 */
export const MIN_FONT_SIZE_LEVEL: MoabomFontSizeLevel = 1;
export const MAX_FONT_SIZE_LEVEL: MoabomFontSizeLevel = 5;
export const DEFAULT_FONT_SIZE_LEVEL: MoabomFontSizeLevel = 2;

/**
 * 글자 크기 단계 → 루트 `html` font-size(px) 매핑.
 * Tailwind/rem 기반이라 이 값이 곧 1rem 기준이 되어 셸·윈도우 앱 텍스트·간격이 비율대로 확대된다.
 */
export const FONT_SIZE_LEVEL_PX: Record<MoabomFontSizeLevel, number> = {
  1: 15,
  2: 16,
  3: 17,
  4: 18,
  5: 19,
};

/**
 * 임의 값을 유효한 글자 크기 단계(1~5)로 정규화한다.
 * 숫자/숫자 문자열을 허용하고 범위를 벗어나면 `fallback` 을 반환한다.
 */
export function normalizeFontSizeLevel(
  value: unknown,
  fallback: MoabomFontSizeLevel = DEFAULT_FONT_SIZE_LEVEL,
): MoabomFontSizeLevel {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  const rounded = Math.round(numeric);
  if (rounded < MIN_FONT_SIZE_LEVEL || rounded > MAX_FONT_SIZE_LEVEL) {
    return fallback;
  }
  return rounded as MoabomFontSizeLevel;
}

export const DEFAULT_MOABOM_SYSTEM: MoabomSystemState = {
  version: 1,
  layout: {
    leftPanelOpen: true,
    rightPanelOpen: true,
    centerMode: 'moabom-apps',
  },
  appearance: {
    theme: 'light',
    pointColor: '#6366f1',
    backgroundImageId: '',
    fontSize: DEFAULT_FONT_SIZE_LEVEL,
  },
  preferences: {
    language: 'ko',
    systemOptions: {
      sound: true,
      animation: true,
      haptic: true,
      toast: true,
      weather: false,
    },
  },
};

export const CENTER_MODE_TO_INDEX: Record<MoabomSystemCenterMode, number> = {
  'moabom-apps': 0,
  sites: 1,
  work: 2,
};

export const INDEX_TO_CENTER_MODE: Record<number, MoabomSystemCenterMode> = {
  0: 'moabom-apps',
  1: 'sites',
  2: 'work',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function normalizeTheme(value: unknown, fallback: MoabomSystemTheme): MoabomSystemTheme {
  return value === 'light' || value === 'dark' || value === 'flat-light' || value === 'flat-dark'
    ? value
    : fallback;
}

function normalizeLanguage(value: unknown, fallback: MoabomSystemLanguage): MoabomSystemLanguage {
  return typeof value === 'string' && isMoabomUiLanguage(value) ? value : fallback;
}

function languageTagToMoabom(tag: string): MoabomSystemLanguage | null {
  const primary = tag.split('-')[0]?.toLowerCase();
  if (!primary || !isMoabomUiLanguage(primary)) return null;
  return primary;
}

/**
 * `Accept-Language`와 유사하게 `navigator.languages` / `navigator.language` 를 순회해
 * 첫 매칭 로케일을 반환합니다. 저장소에 설정이 없을 때 기본 선택에 사용합니다.
 */
export function resolveMoabomLanguageFromBrowser(fallback: MoabomSystemLanguage = 'ko'): MoabomSystemLanguage {
  if (typeof navigator === 'undefined') {
    return fallback;
  }

  const tags = [...(navigator.languages ?? []), navigator.language].filter(
    (t): t is string => typeof t === 'string' && t.length > 0,
  );

  for (const tag of tags) {
    const match = languageTagToMoabom(tag);
    if (match) {
      return match;
    }
  }

  return fallback;
}

function normalizeCenterMode(value: unknown, fallback: MoabomSystemCenterMode): MoabomSystemCenterMode {
  return value === 'moabom-apps' || value === 'sites' || value === 'work' ? value : fallback;
}

function normalizeOptions(value: unknown, fallback: MoabomSystemOptions): MoabomSystemOptions {
  const source = isRecord(value) ? value : {};

  return {
    sound: typeof source.sound === 'boolean' ? source.sound : fallback.sound,
    animation: typeof source.animation === 'boolean' ? source.animation : fallback.animation,
    haptic: typeof source.haptic === 'boolean' ? source.haptic : fallback.haptic,
    toast: typeof source.toast === 'boolean' ? source.toast : fallback.toast,
    weather: typeof source.weather === 'boolean' ? source.weather : fallback.weather,
  };
}

export function defaultsToSystemState(
  defaults?: MoabomSystemDefaults,
): MoabomSystemState {
  const optionDefaults = { ...DEFAULT_MOABOM_SYSTEM.preferences.systemOptions };
  for (const option of defaults?.preferences?.system_options ?? []) {
    const flag = option.on_by_default ?? option.default;
    if (typeof flag === 'boolean' && option.id) {
      optionDefaults[option.id] = flag;
    }
  }

  return {
    ...DEFAULT_MOABOM_SYSTEM,
    appearance: {
      ...DEFAULT_MOABOM_SYSTEM.appearance,
      // 관리자 기본 글자 크기를 baseline 으로 사용 (신규 방문/미저장 사용자 적용)
      fontSize: normalizeFontSizeLevel(
        defaults?.appearance?.font_size_default,
        DEFAULT_MOABOM_SYSTEM.appearance.fontSize,
      ),
    },
    preferences: {
      language: DEFAULT_MOABOM_SYSTEM.preferences.language,
      systemOptions: optionDefaults,
    },
  };
}

export function normalizeMoabomSystemState(value: unknown, base: MoabomSystemState = DEFAULT_MOABOM_SYSTEM): MoabomSystemState {
  const source = isRecord(value) ? value : {};
  const layout = isRecord(source.layout) ? source.layout : {};
  const appearance = isRecord(source.appearance) ? source.appearance : {};
  const preferences = isRecord(source.preferences) ? source.preferences : {};

  return {
    version: 1,
    layout: {
      leftPanelOpen: typeof layout.leftPanelOpen === 'boolean' ? layout.leftPanelOpen : base.layout.leftPanelOpen,
      rightPanelOpen: typeof layout.rightPanelOpen === 'boolean' ? layout.rightPanelOpen : base.layout.rightPanelOpen,
      centerMode: normalizeCenterMode(layout.centerMode, base.layout.centerMode),
    },
    appearance: {
      theme: normalizeTheme(appearance.theme, base.appearance.theme),
      pointColor: isHexColor(appearance.pointColor) ? appearance.pointColor : base.appearance.pointColor,
      backgroundImageId: typeof appearance.backgroundImageId === 'string'
        && (appearance.backgroundImageId === '' || isValidMoabomBackgroundImageId(appearance.backgroundImageId))
        ? appearance.backgroundImageId
        : base.appearance.backgroundImageId,
      fontSize: normalizeFontSizeLevel(appearance.fontSize, base.appearance.fontSize),
    },
    preferences: {
      language: normalizeLanguage(preferences.language, base.preferences.language),
      systemOptions: normalizeOptions(preferences.systemOptions, base.preferences.systemOptions),
    },
  };
}

export function loadMoabomSystemState(base: MoabomSystemState = DEFAULT_MOABOM_SYSTEM): MoabomSystemState {
  try {
    const raw = localStorage.getItem(MOABOM_SYSTEM_STORAGE_KEY);
    if (!raw) {
      const browserAwareBase: MoabomSystemState = {
        ...base,
        preferences: {
          ...base.preferences,
          language: resolveMoabomLanguageFromBrowser(base.preferences.language),
        },
      };
      return normalizeMoabomSystemState(null, browserAwareBase);
    }
    return normalizeMoabomSystemState(JSON.parse(raw), base);
  } catch {
    return base;
  }
}

export function saveMoabomSystemState(state: MoabomSystemState): void {
  const previous = loadMoabomSystemState();
  const normalized = normalizeMoabomSystemState(state, previous);
  if (areMoabomSystemStatesEqual(previous, normalized)) {
    return;
  }
  localStorage.setItem(MOABOM_SYSTEM_STORAGE_KEY, JSON.stringify(normalized));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MOABOM_SYSTEM_STATE_CHANGED_EVENT));
  }
}

export function mergeMoabomSystemState(
  current: MoabomSystemState,
  patch: MoabomSystemStateMergePatch,
): MoabomSystemState {
  return normalizeMoabomSystemState({
    ...current,
    ...patch,
    layout: {
      ...current.layout,
      ...patch.layout,
    },
    appearance: {
      ...current.appearance,
      ...patch.appearance,
    },
    preferences: {
      ...current.preferences,
      ...patch.preferences,
      systemOptions: {
        ...current.preferences.systemOptions,
        ...patch.preferences?.systemOptions,
      },
    },
  }, current);
}

export function hexToRgbString(hex: string): string {
  const normalized = isHexColor(hex) ? hex.slice(1) : DEFAULT_MOABOM_SYSTEM.appearance.pointColor.slice(1);
  const value = Number.parseInt(normalized, 16);

  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

/**
 * 다크 계열 테마 식별자.
 * `classList.add('dark')` 로 Tailwind `dark:` variant 를 활성화한다.
 */
const DARK_THEMES: readonly MoabomSystemTheme[] = ['dark', 'flat-dark'];

/**
 * 모든 테마(라이트/다크/성능 라이트/성능 다크)에서 사용자 선택 포인트 컬러를 그대로 사용한다.
 *
 * 성능(flat-*) 테마는 그림자·blur 등 GPU 비용 높은 효과를 끄는 것이 목적이며,
 * 포인트 컬러 자체는 일반 라이트/다크와 동일하게 사용자 팔레트 선택을 따른다.
 */
export function resolveMoabomBrandColor(_theme: MoabomSystemTheme, pointColor: string): string {
  return isHexColor(pointColor) ? pointColor : DEFAULT_MOABOM_SYSTEM.appearance.pointColor;
}

/**
 * @deprecated 모든 테마가 사용자 포인트 컬러를 따르므로 항상 `false` 를 반환한다.
 * 이전 구현에서 `flat-*` 테마가 브랜드 컬러(네이버/디스코드)를 강제하던 기능은 제거되었다.
 */
export function isBrandEnforcedTheme(_theme: MoabomSystemTheme): boolean {
  return false;
}

/**
 * 셸 테마 단일 소스(C8): `html[data-moa-theme]` + Tailwind `dark:` 용 `.dark` 클래스를
 * 한 곳에서 일관되게 적용한다. 레거시 g7 테마 경로(setThemeHandler/ThemeToggle)도
 * 이 함수로 위임해 `.dark` 와 `data-moa-theme` 가 절대 어긋나지 않도록 한다.
 *
 * 포인트 컬러/배경 등은 건드리지 않으므로(테마 모드 전용) 사용자 팔레트를 덮어쓰지 않는다.
 */
export function applyMoabomSystemThemeMode(theme: MoabomSystemTheme): void {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  root.dataset.moaTheme = theme;

  // 그누보드7 다크 모드 표준: Tailwind `dark:` variant 활성화
  if (DARK_THEMES.includes(theme)) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function applyMoabomSystemAppearance(appearance: MoabomSystemAppearance): void {
  const root = document.documentElement;
  applyMoabomSystemThemeMode(appearance.theme);

  // 포인트 컬러 결정: 모든 테마에서 사용자 선택 포인트 컬러를 그대로 사용
  const effectivePointColor = resolveMoabomBrandColor(appearance.theme, appearance.pointColor);
  root.style.setProperty('--moa-point-color', effectivePointColor);
  root.style.setProperty('--moa-point-rgb', hexToRgbString(effectivePointColor));
  root.style.setProperty(
    '--moa-shell-background-image',
    moabomBackgroundImageCssValue(appearance.backgroundImageId),
  );

  /*
   * 글자 크기: 루트 `html` font-size 를 단계별 px 로 설정한다.
   * Tailwind/rem 기반이라 셸과 모든 윈도우 앱(같은 document) 텍스트·간격이 함께 비율 확대된다.
   * (미디어쿼리 breakpoint 는 브라우저 초기 16px 기준으로 평가되어 영향받지 않는다.)
   */
  const level = normalizeFontSizeLevel(appearance.fontSize, DEFAULT_FONT_SIZE_LEVEL);
  root.style.fontSize = `${FONT_SIZE_LEVEL_PX[level]}px`;
}

/** localStorage 에 Moabom 시스템 상태가 이미 저장되어 있는지(=재방문/기존 사용자) 확인한다. */
export function hasStoredMoabomSystemState(): boolean {
  try {
    return localStorage.getItem(MOABOM_SYSTEM_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/** pull·저장 이벤트 연쇄를 막기 위한 얕은 동등 비교 */
export function areMoabomSystemStatesEqual(a: MoabomSystemState, b: MoabomSystemState): boolean {
  if (a.version !== b.version) {
    return false;
  }
  if (a.preferences.language !== b.preferences.language) {
    return false;
  }

  try {
    return (
      JSON.stringify(a.layout) === JSON.stringify(b.layout)
      && JSON.stringify(a.appearance) === JSON.stringify(b.appearance)
      && JSON.stringify(a.preferences.systemOptions) === JSON.stringify(b.preferences.systemOptions)
    );
  } catch {
    return false;
  }
}
