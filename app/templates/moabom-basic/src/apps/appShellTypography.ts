/**
 * 모아봄 앱 창(moa-shell-app-window) 내부 타이포 통일
 *
 * 반응형: `Moa_Window`가 본문을 `.moa-app-window-viewport`로 감싼다.
 * 창 폭에 맞출 때는 뷰포트용 `sm:` 대신 Tailwind `@sm:`(컨테이너)를 쓴다. 브레이크 수치는 Tailwind 기본(sm 640px, md 768px, lg 1024px, …)과 동일.
 */

import { moaFieldControlClass, moaFieldSelectTriggerClass, moaFieldTextareaClass } from '../theme/moabomFieldSurface';

export { MOA_REUSE_FIELD_LINE } from '../theme/moabomFieldSurface';

/** 본문·필드 라벨·입력값 기본 */
export const APP_SHELL_BODY_CLASS = 'text-base font-bold text-primary';

/** 보조 설명·타임스탬프·빈 상태 안내 등 */
export const APP_SHELL_DESC_CLASS = 'text-base font-bold text-muted';

/** 섹션 제목 (하단 여백 포함) */
export const APP_SHELL_SECTION_TITLE_CLASS = 'text-base font-bold text-primary mb-3';

/**
 * 앱 창(moa-shell-app-window) 안 **주 패널** — 폼·그리드 루트.
 * 자식에 `glass-sm` 인풋·셀렉트가 많을 때 부모는 `moa-group`만 올려 대비를 확보한다.
 * (이유: `.cursor/rules/moabom-architecture.mdc` — 앱 셸 주 패널)
 */
export const APP_SHELL_PANEL_CLASS =
  'moa-group rounded-3xl border border-white/55 dark:border-white/12 p-4 shadow-sm';

/** 단일 라인 텍스트 인풋 — `MOA_REUSE_FIELD_LINE` + `moa-field--medium` (버튼 `moa-btn`+`moa-btn-medium` 과 동일 패턴). */
export const APP_SHELL_INPUT_CLASS = moaFieldControlClass('medium');

/** 멀티라인 프롬프트 등 — `min-h-*`는 화면별로 조합. */
export const APP_SHELL_TEXTAREA_CLASS = moaFieldTextareaClass('medium', 'resize-none');

/** 셀렉트 트리거 — `Select`가 `bg-` 포함으로 커스텀 경로 타도록 동일 계열 유지. */
export const APP_SHELL_SELECT_TRIGGER_CLASS = moaFieldSelectTriggerClass('medium');
