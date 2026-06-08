/**
 * 모아봄 재사용 폼 표면 — **짧은 토큰** + `moa-field--{size}` (버튼 `moa-btn` + `moa-btn-medium` 패턴과 동일한 조합 방식).
 *
 * HTML 공통 골격: `glass-sm moa-field moa-reuse-core` + 크기 티어(`09-form-fields.css`의 `.moa-field--*`).
 * - 멀티라인: `… moa-field--textarea`
 * - 커스텀 Select 트리거: `… moa-reuse-select-row`
 *
 * @see `src/styles/moa-home/24-moa-reuse-field-tokens.css`
 */

export type MoaFieldControlSize = 'xl' | 'large' | 'medium' | 'sm' | 'xs';

const SIZE_CLASS: Record<MoaFieldControlSize, string> = {
  xl: 'moa-field--xl',
  large: 'moa-field--large',
  medium: 'moa-field--medium',
  sm: 'moa-field--sm',
  xs: 'moa-field--xs',
};

/** 단일 라인 인풋·네이티브 select 공통 골격 (표면·타이포·disabled) */
export const MOA_REUSE_FIELD_LINE = 'glass-sm moa-field moa-reuse-core';

/**
 * 텍스트 인풋·네이티브 select 등 단일 라인 컨트롤용 클래스.
 */
export function moaFieldControlClass(size: MoaFieldControlSize = 'medium', extra = ''): string {
  const base = `${MOA_REUSE_FIELD_LINE} ${SIZE_CLASS[size]}`;
  const tail = (extra ?? '').trim();
  return tail ? `${base} ${tail}` : base;
}

/**
 * 멀티라인 textarea — 세로 높이는 `min-h-*` 등으로 소비측에서 지정.
 */
export function moaFieldTextareaClass(size: MoaFieldControlSize = 'medium', extra = ''): string {
  const base = `${MOA_REUSE_FIELD_LINE} moa-field--textarea ${SIZE_CLASS[size]}`;
  const tail = (extra ?? '').trim();
  return tail ? `${base} ${tail}` : base;
}

/**
 * 커스텀 Select 트리거(Button)용: 가로 정렬은 `moa-reuse-select-row`.
 */
export function moaFieldSelectTriggerClass(size: MoaFieldControlSize = 'medium', extra = ''): string {
  return moaFieldControlClass(
    size,
    ['moa-reuse-select-row', extra]
      .filter(Boolean)
      .join(' ')
      .trim(),
  );
}
