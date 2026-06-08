import type { Weather_Snapshot, WeatherEffectId } from './types';

/**
 * 캔버스에 기상 효과를 그리는 단일 진입점 인터페이스.
 *
 * 엔진(`WeatherEffectEngine`) 은 활성 이펙트 집합을 순회하며 아래 4 메서드를 호출한다.
 * 이펙트 사이의 상호 의존은 없으며, 공유 자원은 `particlePool`(파티클 기반 이펙트) · `EffectRenderContext.ctx` 뿐이다.
 */
export interface Effect {
  readonly id: WeatherEffectId;
  update(context: EffectUpdateContext): void;
  render(context: EffectRenderContext): void;
  /**
   * 이펙트가 Weather_Effect_Set 에서 제거될 때 엔진이 호출한다.
   * 파티클 기반 이펙트는 자신의 `kind` 파티클만 제거해야 한다(다른 효과 파티클 유지).
   */
  reset(): void;
  /** 디버그 · 예산 표시 · 테스트 회귀 확인용. */
  getParticleCount(): number;
}

export interface Viewport {
  /** CSS px 기준 캔버스 논리 너비. */
  width: number;
  /** CSS px 기준 캔버스 논리 높이. */
  height: number;
}

export interface EffectUpdateContext {
  /** 직전 update 로부터 경과한 시간(ms). 첫 프레임은 대략 0. */
  deltaMs: number;
  /** 현재 Weather_Snapshot. 없으면 이펙트는 마지막 값을 유지한다. */
  snapshot: Weather_Snapshot | null;
  /** 캔버스 논리 크기(CSS px). 실제 DPR 스케일은 엔진이 `ctx.setTransform` 으로 적용한다. */
  viewport: Viewport;
  /** 한 이펙트가 생성·유지할 수 있는 파티클 수 상한. */
  particleBudget: number;
  /** 파티클 기반 이펙트가 공유하는 풀. 엔진이 메모리 재사용을 위해 단일 배열로 관리한다. */
  particlePool: WeatherParticle[];
  /** 현재 시각(ms, performance.now 기반). 테스트에서는 가상 시계로 주입 가능하다. */
  now: number;
}

export interface EffectRenderContext {
  ctx: CanvasRenderingContext2D;
  viewport: Viewport;
  /** 현재 시각(ms). `render` 가 시간 의존 렌더(예: Lightning flash 잔량) 를 할 때 사용. */
  now: number;
  /** 파티클 기반 이펙트가 공유하는 풀. 엔진이 `update` 와 `render` 에 동일 배열을 전달한다. */
  particlePool: ReadonlyArray<WeatherParticle>;
}

/**
 * 파티클 기반 이펙트(rain · snow · dust) 가 공유하는 단일 파티클 구조체.
 *
 * `kind` 태그로 자신이 속한 이펙트를 구분한다. 풀 단일화로 GC 부담을 줄이고
 * 효과 전환 시 기존 배열을 재사용해 할당/해제를 최소화한다.
 */
export interface WeatherParticle {
  kind: ParticleKind;
  x: number;
  y: number;
  /** 픽셀/초 단위 속도. 엔진이 `deltaMs` 로 스케일링한다. */
  vx: number;
  vy: number;
  /** 이펙트별 크기 파라미터(빗줄기 길이, 눈/모래 반지름 등). */
  size: number;
  /** 0..1 알파값(스노우 flicker 용). */
  alpha: number;
  /** 이펙트가 내부적으로 사용하는 위상값(스노우 흔들림 phase 등). */
  phase: number;
}

export type ParticleKind = 'rain' | 'snow' | 'dust';

/**
 * 파티클 배열에서 특정 `kind` 항목만 in-place 로 제거한다.
 * 풀 단일화 계약에 따라 다른 이펙트의 파티클은 유지한다.
 */
export function removeParticlesOfKind(pool: WeatherParticle[], kind: ParticleKind): void {
  let write = 0;
  for (let read = 0; read < pool.length; read += 1) {
    if (pool[read].kind !== kind) {
      pool[write] = pool[read];
      write += 1;
    }
  }
  pool.length = write;
}

/**
 * 파티클 배열에서 특정 `kind` 항목 개수를 센다.
 */
export function countParticlesOfKind(pool: ReadonlyArray<WeatherParticle>, kind: ParticleKind): number {
  let count = 0;
  for (let i = 0; i < pool.length; i += 1) {
    if (pool[i].kind === kind) count += 1;
  }
  return count;
}
