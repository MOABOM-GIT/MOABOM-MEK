import type { ButtonProps } from '../../basic/Button';
import { APP_SHELL_PANEL_CLASS } from '../../../apps/appShellTypography';
import { moaFieldControlClass, moaFieldTextareaClass } from '../../../theme/moabomFieldSurface';

/** 마이페이지 창 루트 — 패딩은 `.moa-app-window-viewport` SSOT */
export const OUTER_GLASS = 'moa-mypage-surface';
export const SIDEBAR_GROUP = `${APP_SHELL_PANEL_CLASS} py-4 px-1`;
/** 마이페이지·앱 창 공통 섹션 패널 — `APP_SHELL_PANEL_CLASS` 와 동일 */
export const GROUP_PANEL = APP_SHELL_PANEL_CLASS;
/** 단일 라인 텍스트 인풋 — `.moa-field` + 버튼 `medium` 티어 치수 (`moa-home/09-form-fields.css`). */
export const INPUT_SURFACE = moaFieldControlClass('medium');
/** 멀티라인 — 최소 높이는 소비자가 `min-h-*`로 덧씌운다. */
export const TEXTAREA_SURFACE = moaFieldTextareaClass('medium', 'resize-none');
export const ACTION_BUTTON_VARIANT: ButtonProps['variant'] = 'primary-outline';
export const TAB_BUTTON_BASE = 'w-full justify-start gap-3 moa-app-panel px-3 py-3 text-left transition-[background-color,box-shadow,opacity]';
export const ACTIVE_TAB_CLASS = 'moa-point-fill text-white cursor-pointer';
/** 라벨/설명 색은 자식(Marquee·desc)에서 지정 — 루트는 글래스+호버만 */
export const INACTIVE_TAB_CLASS = 'glass-sm cursor-pointer hover:opacity-95';
/** 비활성(게스트 잠금 등): 클릭 불가 — 손모양 커서 없음 */
export const DISABLED_TAB_CLASS = 'glass-sm text-faint opacity-55 grayscale cursor-default';

/** 본문 블록 제목 타포그래피 (여백 없음 — 플렉스 행·인라인 조합용) */
export const MY_PAGE_BLOCK_TITLE_TEXT_CLASS = 'text-sm font-bold text-primary';
/** 본문 블록 제목·폼 라벨 통일 (섹션 헤더·앱 보관함 구역 제목·크레딧 최근 내역 등) */
export const MY_PAGE_BLOCK_TITLE_CLASS = `${MY_PAGE_BLOCK_TITLE_TEXT_CLASS} mb-3`;
