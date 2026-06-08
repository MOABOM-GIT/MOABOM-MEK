import type { MoabomSystemOptionConfig, MoabomSystemOptions } from '../types/moabomSystem';

/**
 * 런타임이 실제로 따르는 해석된 시스템 옵션 값.
 *
 * `MoabomSystemOptions` 와 동일 필드 구성을 가지되, "원본 사용자 선택" 이 아니라
 * `computeEffectiveSystemOptions` 의 결과(관리자 기본값 · 사용자 오버라이드 ·
 * OS prefers-reduced-motion 신호의 우선순위 해석본) 임을 타입 레벨에서 구분한다.
 *
 * 이 타입을 소비하는 Runtime Effect 레이어는 값을 읽기 전용으로만 다루고
 * 재계산은 상위 훅(`useEffectiveSystemOptions`) 이 전담한다.
 */
export type EffectiveSystemOptions = Readonly<MoabomSystemOptions>;

/**
 * `computeEffectiveSystemOptions` 순수 함수의 입력 스키마.
 *
 * - `adminOptions` : Public_Defaults_API · User_Settings_API 응답의
 *   `defaults.preferences.system_options` 배열. 서버 누락 시 `null` / `undefined`.
 * - `userOverrides` : 로그인 사용자의 개인 선택. 비로그인 셸 또는 서버 미저장 시 `undefined`.
 * - `osReducedMotion` : `matchMedia('(prefers-reduced-motion: reduce)')` 의 현재 매칭 여부.
 */
export interface EffectiveSystemOptionsInputs {
  adminOptions: MoabomSystemOptionConfig[] | null | undefined;
  userOverrides: Partial<MoabomSystemOptions> | undefined;
  osReducedMotion: boolean;
}

/**
 * Toast 항목의 중요도 분류.
 *
 * - `'system'` : 저장 성공/실패, 검증 오류, 권한 오류, 업로드 진행 등
 *   사용자 액션에 대한 즉각적 피드백. `toast` 옵션 off 상태에서도 항상 렌더한다.
 * - `'content'` : 댓글·게시물 등 passive notification. `toast` 옵션 off 상태에서 차단한다.
 *
 * 미지정(`undefined`) 은 런타임에서 `'content'` 로 취급한다(Req 5.4 회귀 방지 계약).
 */
export type ToastSeverity = 'system' | 'content';

/**
 * 현재 브라우저 환경이 Web Vibration API 를 실효적으로 지원하는지 판정하는
 * 순수 probe 함수의 타입. `isHapticSupportedEnvironment` 가 이 시그니처를 구현한다.
 *
 * Req 12.4 의 판정 규칙(`navigator.vibrate` 타입 체크 + UA 기반 iOS 판정) 을 캡슐화한다.
 */
export type HapticSupportedEnvironmentProbe = () => boolean;
