import { DEFAULT_MOABOM_SYSTEM } from '../utils/moabomSystemStore';
import type { EffectiveSystemOptions } from './types';

/**
 * 런타임의 현재 Effective_Option_Value 스냅샷 — module-level 변수.
 * 최초 값은 `DEFAULT_MOABOM_SYSTEM.preferences.systemOptions` 를 복사하여 초기화한다.
 */
let latest: EffectiveSystemOptions = {
  ...DEFAULT_MOABOM_SYSTEM.preferences.systemOptions,
};

/**
 * React 훅 밖(이벤트 핸들러 · 사운드/햅틱 유틸 · Toast 렌더 가드 등) 에서도
 * 최신 Effective_Option_Value 를 **동기적으로** 조회할 수 있도록 제공하는 전역 레지스트리.
 *
 * - 진입점은 `useEffectiveSystemOptions` 훅이며, 훅이 매 재계산 후 `_setEffectiveOptions`
 *   (내부 API) 를 호출해 본 레지스트리의 값을 교체한다.
 * - `getEffectiveOptions / getEffectiveOption` 은 단순 getter 이므로 부작용이 없고,
 *   테스트에서도 쉽게 mock · reset 할 수 있다.
 *
 * Req 11.1/11.2/11.3: 훅이 상태 변화를 감지해 본 레지스트리를 갱신하면
 * 이후 동기 getter 호출자는 항상 마지막 값으로 수렴한다.
 */
export const MoabomRuntime = {
  /** 현재 전체 Effective_Option_Value 스냅샷(읽기 전용). */
  getEffectiveOptions(): EffectiveSystemOptions {
    return latest;
  },

  /** 특정 옵션의 현재 Effective_Option_Value 를 읽는다. */
  getEffectiveOption<K extends keyof EffectiveSystemOptions>(id: K): boolean {
    return latest[id];
  },

  /**
   * 훅 내부 전용 setter — 외부 모듈에서 호출하지 말 것.
   * `useEffectiveSystemOptions` 의 effect 가 `computeEffectiveSystemOptions` 재계산 후
   * 결과 참조가 달라졌을 때만 호출한다.
   *
   * @internal
   */
  _setEffectiveOptions(next: EffectiveSystemOptions): void {
    latest = next;
  },
};
