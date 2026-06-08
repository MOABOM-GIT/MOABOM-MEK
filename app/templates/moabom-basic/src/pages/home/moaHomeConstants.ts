/** localStorage 키 — 메인 그리드 한 판 */
export const STORAGE_KEY_ORDER = 'moabom_main_order';
export const STORAGE_KEY_FAVORITES = 'moabom_favorites';
export const STORAGE_KEY_TASKBAR_ICONS = 'moabom_taskbar_icons';
export const STORAGE_KEY_RECENT_APPS = 'moabom_recent_apps';

export const BREAKPOINT_RIGHT_OVERLAY = 1400;
export const BREAKPOINT_MOBILE_OVERLAY = 1000;
export const BREAKPOINT_FULLSCREEN_WINDOW = 768;
/** 최소 폭 티어(콤팩트 컨트롤·패널 screen-edge flush 등) */
export const BREAKPOINT_COMPACT_CONTROLS = 480;

export const AUTH_WINDOW_APP_IDS = ['login', 'register', 'forgot-password', 'reset-password'] as const;

export const MAX_OPEN_WINDOWS = 5;
export const MAX_TASKBAR_ITEMS = 10;
export const MAX_RECENT_APPS = 9;
export const DEFAULT_WINDOW_WIDTH = 1050;
export const DEFAULT_WINDOW_HEIGHT = 768;

/** sirsoft-page 약관·개인정보 창 기본 크기 */
export const LEGAL_PAGE_WINDOW_WIDTH = 720;
export const LEGAL_PAGE_WINDOW_HEIGHT = 680;
export const AUTH_WINDOW_WIDTH = 482;
export const AUTH_WINDOW_HEIGHT = 520;
export const WINDOW_CASCADE_STEP = 10;

/** 관리자 저장 후 서버 defaults 재조회 디바운스(ms) */
export const MOABOM_SHELL_SERVER_PULL_DEBOUNCE_MS = 180;

/**
 * 로그인·회원가입·비번 창, 이용약관·개인정보 처리방침 등 셸 고정 창 타이틀 배경.
 * `--moa-point-color`만 사용(모드별 고정 hex 그라데이션은 포인트 변경과 어긋나 제거함).
 */
export const MOA_SHELL_POINT_TITLE_GRADIENT =
  'linear-gradient(135deg, color-mix(in srgb, var(--moa-point-color) 78%, white), var(--moa-point-color))';

/** 좌·중앙·우 패널 레이아웃 */
export const MOA_HOME_PANEL_WIDTH = 310;
export const MOA_HOME_EDGE = 20;
export const MOA_HOME_INNER = 10;
export const MOA_HOME_OVERLAY_EDGE = 10;
