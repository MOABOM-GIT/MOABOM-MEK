export type MoabomSystemTheme = 'light' | 'dark' | 'flat-light' | 'flat-dark';
export type MoabomSystemLanguage = 'ko' | 'en' | 'ja' | 'zh';
export type MoabomSystemCenterMode = 'moabom-apps' | 'sites' | 'work';

/**
 * 글자 크기 단계(1~5). 루트 `html` font-size 를 스케일하는 데 사용한다.
 * 1=가장 작음, 3=기본, 5=가장 큼. rem 기반이므로 셸·윈도우 앱 전체가 비율대로 확대된다.
 */
export type MoabomFontSizeLevel = 1 | 2 | 3 | 4 | 5;

export interface MoabomSystemLayout {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  centerMode: MoabomSystemCenterMode;
}

export interface MoabomSystemAppearance {
  theme: MoabomSystemTheme;
  pointColor: string;
  /** 홈 셸 배경 — 관리자가 업로드한 UUID 또는 빈 문자열(배경 없음). */
  backgroundImageId: string;
  /** 글자 크기 단계(1~5, 기본 2). 루트 `html` font-size 스케일로 적용된다. */
  fontSize: MoabomFontSizeLevel;
}

export interface MoabomSystemOptions {
  sound: boolean;
  animation: boolean;
  haptic: boolean;
  toast: boolean;
  weather: boolean;
}

export interface MoabomSystemPreferences {
  language: MoabomSystemLanguage;
  systemOptions: MoabomSystemOptions;
}

export interface MoabomSystemState {
  version: 1;
  layout: MoabomSystemLayout;
  appearance: MoabomSystemAppearance;
  preferences: MoabomSystemPreferences;
}

/** mergeMoabomSystemState 시 layout·appearance·preferences는 필드 단위 부분 갱신 */
export type MoabomSystemStateMergePatch = Omit<Partial<MoabomSystemState>, 'layout' | 'appearance' | 'preferences'> & {
  layout?: Partial<MoabomSystemLayout>;
  appearance?: Partial<MoabomSystemAppearance>;
  preferences?: Partial<Omit<MoabomSystemPreferences, 'systemOptions'>> & {
    systemOptions?: Partial<MoabomSystemOptions>;
  };
};

export interface MoabomSystemMenuConfig {
  id: string;
  label: string;
  description: string;
  icon: string;
  enabled: boolean;
  guest_enabled: boolean;
  order: number;
}

export interface MoabomSystemChoice {
  id: string;
  label: string;
  enabled: boolean;
}

export interface MoabomSystemOptionConfig {
  id: keyof MoabomSystemOptions;
  label: string;
  /** 플랫폼 기본 켜짐 여부 (구 `default` — API/저장 키) */
  on_by_default?: boolean;
  /** @deprecated 구 폼/저장 */
  default?: boolean;
  user_editable: boolean;
}

export interface MoabomSystemDefaults {
  mypage?: {
    menus?: MoabomSystemMenuConfig[];
  };
  appearance?: {
    themes?: MoabomSystemChoice[];
    point_color_presets?: string[];
    /** 관리자가 지정한 기본 글자 크기 단계(1~5). 아직 폰트를 바꾸지 않은 고객/비회원에게 적용. */
    font_size_default?: number;
    /**
     * 운영자 업로드 배경(UUID) 목록(순서 유지).
     * - `mode` : 이 배경이 노출될 테마 모드(라이트/다크). 누락 시 마이페이지는 'light' 로 간주한다.
     * - `point_color` : 이 배경에 바인딩된 포인트 컬러 hex (`#rrggbb`). 마이페이지에서 해당 색을 클릭하면 이 배경이 자동 선택된다.
     *   같은 hex 는 한 번만 바인딩될 수 있다(서버 저장 시 유일성 강제).
     */
    home_background_items?: Array<{
      id: string;
      mode?: 'light' | 'dark';
      point_color?: string | null;
      url?: string;
      thumb_url?: string;
    }>;
  };
  preferences?: {
    languages?: MoabomSystemChoice[];
    /** @deprecated 기본 언어는 브라우저 감지 또는 고객 선택으로 결정 */
    default_language?: MoabomSystemLanguage;
    system_options?: MoabomSystemOptionConfig[];
  };
}
