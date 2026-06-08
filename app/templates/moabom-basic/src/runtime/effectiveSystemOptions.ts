import type { MoabomSystemOptionConfig, MoabomSystemOptions } from '../types/moabomSystem';
import { DEFAULT_MOABOM_SYSTEM } from '../utils/moabomSystemStore';
import type { EffectiveSystemOptions, EffectiveSystemOptionsInputs } from './types';

/**
 * 런타임이 실제로 따를 시스템 옵션 값(Effective_Option_Value) 을 계산한다.
 *
 * 본 함수는 외부 상태(localStorage · DOM · `matchMedia`) 를 직접 읽지 않고
 * 인자로 주어진 스냅샷만 사용하는 **순수 함수**다. Property-based 테스트로
 * Requirement 1 의 우선순위 계약 전체 공간을 검증할 수 있도록 격리되었다.
 *
 * 해석 단계(Req 1.1~1.6 / Req 2.4):
 * 1. baseline 으로 `DEFAULT_MOABOM_SYSTEM.preferences.systemOptions` 를 깔고 시작한다.
 *    (Req 1.5 — 관리자 설정에 존재하지 않는 옵션 id 는 템플릿 하드코딩 기본값을 따른다.)
 * 2. `adminOptions` 의 각 엔트리를 순회하며 baseline 의 `on_by_default` 를 덮어쓴다.
 *    (Req 1.3 / 1.4 — 오버라이드가 없는 경우의 기본 출발선.)
 * 3. `user_editable === true` 이고 `userOverrides[id]` 가 boolean 으로 저장되어 있으면
 *    사용자 값으로 덮어쓴다. (Req 1.2)
 * 4. `user_editable === false` 이면 사용자 값을 무시한다. (Req 1.1 / 1.6)
 * 5. 마지막으로 `osReducedMotion === true` 이면 `animation` 을 `false` 로 강제한다.
 *    (Req 2.4 — OS 신호는 관리자 · 사용자 설정보다 우선)
 *
 * @param inputs `EffectiveSystemOptionsInputs` — adminOptions, userOverrides, osReducedMotion
 * @returns     `EffectiveSystemOptions` (Readonly) — 런타임 효과 레이어가 소비할 해석본
 */
export function computeEffectiveSystemOptions(
  inputs: EffectiveSystemOptionsInputs,
): EffectiveSystemOptions {
  const { adminOptions, userOverrides, osReducedMotion } = inputs;

  // 1) baseline 복사 (변경 가능한 중간 객체로 쌓는다)
  const result: MoabomSystemOptions = {
    ...DEFAULT_MOABOM_SYSTEM.preferences.systemOptions,
  };

  // `user_editable` 판정을 위해 adminOptions 를 id => 엔트리로 색인한다.
  // 동일 id 가 중복 등장하면 나중에 나타난 엔트리가 이긴다(현행 계약과 동일).
  const adminIndex = new Map<keyof MoabomSystemOptions, MoabomSystemOptionConfig>();
  for (const entry of adminOptions ?? []) {
    if (!entry || typeof entry.id !== 'string') continue;
    if (!(entry.id in result)) continue; // 허용 id 외는 무시(스키마 이탈 방어)
    adminIndex.set(entry.id as keyof MoabomSystemOptions, entry);
  }

  // 2) adminOptions 의 on_by_default 로 baseline 을 덮는다.
  for (const [id, entry] of adminIndex) {
    const base = entry.on_by_default ?? entry.default;
    if (typeof base === 'boolean') {
      result[id] = base;
    }
  }

  // 3) user_editable === true 이고 userOverrides 가 있을 때만 사용자 값으로 덮는다.
  if (userOverrides) {
    for (const key of Object.keys(result) as Array<keyof MoabomSystemOptions>) {
      const override = userOverrides[key];
      if (typeof override !== 'boolean') continue;

      const admin = adminIndex.get(key);
      // admin 엔트리가 없으면 허용 id 이므로 baseline 에 대해 사용자 값 존중(Req 1.5 baseline + 1.2 사용자 값)
      // admin 엔트리가 있으면 user_editable === true 일 때만 덮는다.
      if (admin && admin.user_editable === false) continue;

      result[key] = override;
    }
  }

  // 5) OS reduced-motion 은 최상위 우선 — 관리자 잠금 · 사용자 선택에 무관하게 animation 차단.
  if (osReducedMotion) {
    result.animation = false;
  }

  /*
   * 6) animation → weather 연동(사용자 요청).
   *    animation 이 꺼지면 날씨 효과의 캔버스 렌더도 의미가 없어지므로 effective 값에서도 함께 꺼둔다.
   *    `MoabomRuntime.getEffectiveOption('weather')` 동기 getter 결과가 `shouldRender` 합성과
   *    일관되도록 강제하는 목적이다. raw 저장값(`userOverrides.weather`) 은 건드리지 않으므로
   *    animation 을 다시 켜면 사용자의 이전 선택이 자연히 부활한다.
   */
  if (result.animation === false) {
    result.weather = false;
  }

  return result as EffectiveSystemOptions;
}
