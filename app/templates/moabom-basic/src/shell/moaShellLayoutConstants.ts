/** localStorage 키 — 메인 그리드 한 판 */
export const STORAGE_KEY_ORDER = 'moabom_main_order';
export const STORAGE_KEY_CREATE_APP_ORDER_MIGRATED = 'moabom_create_app_order_migrated';
export const STORAGE_KEY_FAVORITES = 'moabom_favorites';
export const STORAGE_KEY_TASKBAR_ICONS = 'moabom_taskbar_icons';
export const STORAGE_KEY_RECENT_APPS = 'moabom_recent_apps';
/** @deprecated 구 앱별 최대화 맵 — 전역 키로 이전, 읽기 호환만 유지 */
export const STORAGE_KEY_APP_MAXIMIZED = 'moabom_app_maximized';
/** 셸 윈도우 전역 최대화 선호 (boolean JSON) */
export const STORAGE_KEY_SHELL_WINDOWS_MAXIMIZED = 'moabom_shell_windows_maximized';

export const BREAKPOINT_RIGHT_OVERLAY = 1400;
export const BREAKPOINT_MOBILE_OVERLAY = 1000;
export const BREAKPOINT_FULLSCREEN_WINDOW = 768;
/** 최소 폭 티어(콤팩트 컨트롤·패널 screen-edge flush 등) */
export const BREAKPOINT_COMPACT_CONTROLS = 480;

export const AUTH_WINDOW_APP_IDS = ['login', 'register', 'forgot-password', 'reset-password'] as const;

export const MAX_OPEN_WINDOWS = 5;
export const MAX_TASKBAR_ITEMS = 10;
export const MAX_RECENT_APPS = 10;
export const DEFAULT_WINDOW_WIDTH = 1280;
export const DEFAULT_WINDOW_HEIGHT = 800;

/** sirsoft-page 약관·개인정보 창 기본 크기 */
export const LEGAL_PAGE_WINDOW_WIDTH = 720;
export const LEGAL_PAGE_WINDOW_HEIGHT = 680;

/** sirsoft-board 게시판 윈도우 기본 크기 */
export const BOARD_WINDOW_WIDTH = 1100;
export const BOARD_WINDOW_HEIGHT = 760;

export const USER_PROFILE_WINDOW_WIDTH = 920;
export const USER_PROFILE_WINDOW_HEIGHT = 680;

/** 앱 리뷰 셸 창 기본 크기 */
export const APP_COMMUNITY_WINDOW_WIDTH = 520;
export const APP_COMMUNITY_WINDOW_HEIGHT = 640;

/** G7 errors JSON 에러 윈도우 기본 크기 */
export const ERROR_WINDOW_WIDTH = 480;
export const ERROR_WINDOW_HEIGHT = 360;
export const AUTH_WINDOW_WIDTH = 482;
export const AUTH_WINDOW_HEIGHT = 520;
export const WINDOW_CASCADE_STEP = 10;

/** 관리자 저장 후 서버 defaults 재조회 디바운스(ms) */
/** focus/visibility 재pull — 이중·연속 트리거 압축 (WS-first 리팩토링) */
export const MOABOM_SHELL_SERVER_PULL_DEBOUNCE_MS = 800;

/**
 * 로그인·회원가입·비번 창, 이용약관·개인정보 처리방침 등 셸 고정 창 타이틀 배경.
 * `--moa-point-color`만 사용(모드별 고정 hex 그라데이션은 포인트 변경과 어긋나 제거함).
 */
export const MOA_SHELL_POINT_TITLE_GRADIENT =
  'linear-gradient(135deg, color-mix(in srgb, var(--moa-point-color) 78%, white), var(--moa-point-color))';

/** 좌·중앙·우 패널 레이아웃 */
export const MOA_HOME_PANEL_WIDTH = 310;
export const MOA_HOME_EDGE = 15;
export const MOA_HOME_INNER = 10;
export const MOA_HOME_OVERLAY_EDGE = 10;
