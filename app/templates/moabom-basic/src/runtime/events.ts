/**
 * Effective_Option_Value 가 실제로 바뀌었을 때 발행하는 `window` 이벤트 이름.
 *
 * - 기존 `MOABOM_SYSTEM_STATE_CHANGED_EVENT` 는 "저장값(MoabomSystemState) 변경" 을 알린다.
 * - 본 이벤트는 "해석된 Effective 값 변경" 을 알린다.
 *   OS `prefers-reduced-motion` 변화처럼 저장값은 그대로이지만 effective 값만 바뀌는
 *   경로에서도 구독자가 즉시 리렌더할 수 있도록 별도 이벤트로 유지한다(D4 확정).
 *
 * 발행 주체: `useEffectiveSystemOptions` 훅
 * 구독 주체: `Toast.tsx` 등 동기 getter 기반으로 렌더를 바꾸는 컴포넌트
 */
export const MOABOM_RUNTIME_OPTIONS_CHANGED_EVENT = 'moabom-runtime-options-changed';
