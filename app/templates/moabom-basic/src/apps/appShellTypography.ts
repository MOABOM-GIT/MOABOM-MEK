/**
 * 모아봄 앱 창 본문 루트 — `.moa-app-window-viewport` 가 패딩·스크롤 SSOT.
 * 반응형: `appWindowBreakpoints.ts` · `@sm:`/`@md:`/`@lg:`/`@xl:` (컨테이너 변형).
 */

import { moaFieldControlClass, moaFieldSelectTriggerClass, moaFieldTextareaClass } from '../theme/moabomFieldSurface';

export { MOA_APP_WINDOW_CQ } from './appWindowBreakpoints';

export { MOA_REUSE_FIELD_LINE } from '../theme/moabomFieldSurface';

/** 창 본문 직계 루트 — flex 세로 스택·gap 만 담당 (패딩 X). */
export const APP_WINDOW_BODY_CLASS = 'moa-app-window-body';

/** 앱 창 본문 블록(섹션) 사이 세로·그리드 간격 — `01-tokens.css` `--moa-app-stack-gap` */
export const APP_STACK_CLASS = 'moa-app-stack';
export const APP_STACK_GRID_CLASS = 'moa-app-stack-grid';

/** @deprecated `APP_WINDOW_BODY_CLASS` 사용 — CSS 호환용 별칭 */
export const APP_SHELL_WINDOW_CLASS = 'moa-shell-app-window';

/** 본문·필드 라벨·입력값 기본 */
export const APP_SHELL_BODY_CLASS = 'text-base font-bold text-primary';

/** 보조 설명·타임스탬프·빈 상태 안내 등 */
export const APP_SHELL_DESC_CLASS = 'text-base font-bold text-muted';

/** 앱 창 내부 패널 곡률 — `33-app-panel-radius.css` `--moa-app-panel-radius` SSOT */
export const MOA_APP_PANEL_CLASS = 'moa-app-panel';
export const MOA_APP_PANEL_SM_CLASS = 'moa-app-panel-sm';
export const MOA_APP_PANEL_INNER_CLASS = 'moa-app-panel-inner';
export const MOA_APP_PANEL_ICON_CLASS = 'moa-app-panel-icon';

/** 섹션 제목 (하단 여백 포함) */
export const APP_SHELL_SECTION_TITLE_CLASS = 'text-base font-bold text-primary mb-3';

/** `moa-group` 패널 공통 테두리 — 프로필 보기·마이페이지·앱 창 SSOT */
export const MOA_GROUP_BORDER_CLASS = 'border border-gray-200 dark:border-gray-700';

/** 앱 창 내부 섹션 패널 — 마이페이지와 동일한 심플 표면 SSOT */
export const APP_SHELL_PANEL_CLASS = `moa-group moa-app-panel ${MOA_GROUP_BORDER_CLASS}`;

/** 기본 패딩(p-5) 포함 — 대부분의 앱·마이페이지 섹션 루트 */
export const APP_SHELL_PANEL_BODY_CLASS = `${APP_SHELL_PANEL_CLASS} p-5`;

/** 패딩 + 세로 스택 — 폼·설문 섹션 */
export const APP_SHELL_PANEL_STACK_CLASS = `${APP_SHELL_PANEL_BODY_CLASS} ${APP_STACK_CLASS}`;

/** @deprecated `APP_SHELL_PANEL_CLASS` — 호환 별칭 */
export const MOA_APP_PANEL_SURFACE_CLASS = APP_SHELL_PANEL_CLASS;

/** 단일 라인 텍스트 인풋 — `MOA_REUSE_FIELD_LINE` + `moa-field--medium` (버튼 `moa-btn`+`moa-btn-medium` 과 동일 패턴). */
export const APP_SHELL_INPUT_CLASS = moaFieldControlClass('medium');

/** 멀티라인 프롬프트 등 — `min-h-*`는 화면별로 조합. */
export const APP_SHELL_TEXTAREA_CLASS = moaFieldTextareaClass('medium', 'resize-none');

/** 셀렉트 트리거 — `Select`가 `bg-` 포함으로 커스텀 경로 타도록 동일 계열 유지. */
export const APP_SHELL_SELECT_TRIGGER_CLASS = moaFieldSelectTriggerClass('medium');
