import type {
  Effect,
  EffectRenderContext,
  EffectUpdateContext,
  WeatherParticle,
} from './Effect';
import { DustEffect } from './effects/DustEffect';
import { FogLayer } from './effects/FogLayer';
import { LightningOverlay } from './effects/LightningOverlay';
import { RainEffect } from './effects/RainEffect';
import { SmogLayer } from './effects/SmogLayer';
import { SnowEffect } from './effects/SnowEffect';
import { WEATHER_DPR_CAP, WEATHER_DEFAULT_PARTICLE_BUDGET } from './constants';
import type {
  Weather_Snapshot,
  WeatherEffectId,
  WeatherEffectSet,
} from './types';

export interface WeatherEffectEngineOptions {
  canvas: HTMLCanvasElement;
  /** `resolveParticleBudget` 결과 (초기 예산). */
  initialBudget?: number;
  /** 프레임 시간이 `>8ms` 로 연속 초과 시 예산을 절반으로 줄이는 트리거(Req 5.6). 기본 20. */
  budgetDropFrameThreshold?: number;
  /** 프레임 예산 초과 경계(ms). 기본 8(Req 5.5). */
  frameTimeBudgetMs?: number;
  /** DPR 상한(기본 1.5 — Req 5.4). */
  dprCap?: number;
  /** RAF 주입(테스트용). 기본 `requestAnimationFrame`. */
  requestFrame?: (cb: FrameRequestCallback) => number;
  /** cancelAnimationFrame 주입(테스트용). */
  cancelFrame?: (handle: number) => void;
  /** 시계 주입(테스트용). 기본 `performance.now`. */
  now?: () => number;
}

/**
 * 공용 파티클 풀 + 오버레이 + Lightning 스케줄링을 소유하는 단일 RAF 엔진(설계 §1.1).
 *
 * 책임 요약:
 * - Weather_Render_Loop 를 단 하나의 `requestAnimationFrame` 으로 스케줄(Req 1.1 · 5.1 · 5.2 — 외부 훅이 시점 결정).
 * - `stop()` 시 `clearRect` 1회 + 파티클 배열·오버레이 상태 해제(Req 1.2 · 1.3).
 * - `setEffectSet(next)` 전이 시 이펙트 생성/제거 — 제거된 이펙트의 파티클은 공용 풀에서 즉시 지운다(Req 4a.4 · 4b.3 등).
 * - 프레임 시간이 `>8ms` 로 연속 초과되면 파티클 예산을 절반으로 감소시켜 60fps 을 유지하려 시도한다(Req 5.6).
 * - DPR 상한 1.5 — 버퍼는 `CSS px × dpr`, `ctx.setTransform(dpr)` 로 논리(CSS) 좌표 보존(Req 5.4).
 *   버퍼를 CSS 만으로 두면 논리 뷰포트가 `CSS/dpr` 로 줄어 비가 굵고 빽빽해 보인다.
 * - `canvas.width/height` 변경은 context 를 리셋하므로 `syncSurface`·매 프레임에서 transform 을 재적용한다.
 * - `canvas.getContext('2d') === null` 인 환경에서 `start()` 는 no-op 로 전이한다.
 */
export class WeatherEffectEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly requestFrame: (cb: FrameRequestCallback) => number;
  private readonly cancelFrame: (handle: number) => void;
  private readonly now: () => number;
  private readonly budgetDropFrameThreshold: number;
  private readonly frameTimeBudgetMs: number;
  private readonly dpr: number;

  private readonly particlePool: WeatherParticle[] = [];
  private readonly activeEffects = new Map<WeatherEffectId, Effect>();
  private snapshot: Weather_Snapshot | null = null;
  private particleBudget: number;

  private running = false;
  private frameHandle: number | null = null;
  private lastFrameAt: number | null = null;
  private consecutiveSlowFrames = 0;
  private budgetAlreadyDropped = false;

  constructor(options: WeatherEffectEngineOptions) {
    this.canvas = options.canvas;
    this.ctx = options.canvas.getContext('2d');
    this.requestFrame = options.requestFrame ?? ((cb) => requestAnimationFrame(cb));
    this.cancelFrame = options.cancelFrame ?? ((handle) => cancelAnimationFrame(handle));
    this.now = options.now ?? (() => performance.now());
    this.budgetDropFrameThreshold = options.budgetDropFrameThreshold ?? 20;
    this.frameTimeBudgetMs = options.frameTimeBudgetMs ?? 8;
    this.dpr = Math.min(
      typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1,
      options.dprCap ?? WEATHER_DPR_CAP,
    );
    this.particleBudget = options.initialBudget ?? WEATHER_DEFAULT_PARTICLE_BUDGET;
    this.applyDprTransform();
  }

  /**
   * CSS 표시 크기에 맞춰 버퍼(`CSS × dpr`)를 맞추고 DPR transform 을 복구한다.
   * `canvas.width/height` 할당은 2D context 를 리셋하므로 반드시 transform 을 다시 건다.
   */
  syncSurface(cssWidth?: number, cssHeight?: number): void {
    const fallbackW = typeof window !== 'undefined' ? window.innerWidth : this.getLogicalWidth();
    const fallbackH = typeof window !== 'undefined' ? window.innerHeight : this.getLogicalHeight();
    const cssW = Math.max(
      1,
      Math.floor(cssWidth ?? (this.canvas.clientWidth || fallbackW)),
    );
    const cssH = Math.max(
      1,
      Math.floor(cssHeight ?? (this.canvas.clientHeight || fallbackH)),
    );
    const bufferW = Math.max(1, Math.floor(cssW * this.dpr));
    const bufferH = Math.max(1, Math.floor(cssH * this.dpr));

    // 동일 값 재할당도 일부 엔진에서 context 를 리셋하므로, 변경 시에만 쓴다.
    if (this.canvas.width !== bufferW) {
      this.canvas.width = bufferW;
    }
    if (this.canvas.height !== bufferH) {
      this.canvas.height = bufferH;
    }
    this.applyDprTransform();
  }

  /** 테스트·디버그용 DPR(클램프 후). */
  getDprForTesting(): number {
    return this.dpr;
  }

  /** RAF 루프를 시작한다. 이미 실행 중이거나 ctx 미가용이면 no-op(설계 §1.1 안전망). */
  start(): void {
    if (this.running || !this.ctx) return;
    this.running = true;
    this.lastFrameAt = null;
    this.consecutiveSlowFrames = 0;
    this.frameHandle = this.requestFrame(this.tick);
  }

  /** RAF 루프 중지 + clearRect + 파티클/오버레이 해제(Req 1.2 · 1.3). */
  stop(): void {
    if (!this.running) {
      // start 전 상태에서도 clearRect 는 한번 돌아 안전 — 이펙트 잔상이 남지 않도록.
      this.clearCanvas();
      return;
    }
    this.running = false;
    if (this.frameHandle !== null) {
      this.cancelFrame(this.frameHandle);
      this.frameHandle = null;
    }
    this.lastFrameAt = null;

    // clearRect + 풀/오버레이 해제
    this.clearCanvas();
    this.particlePool.length = 0;
    // 각 활성 이펙트의 내부 상태 초기화(Fog/Smog progress, Lightning 스케줄러 등).
    for (const effect of this.activeEffects.values()) {
      effect.reset();
    }
  }

  /**
   * 활성 이펙트 집합을 갱신한다. 교집합은 유지, 추가/제거는 즉시 반영한다.
   * 제거된 이펙트의 파티클은 공용 풀에서 즉시 제거한다(Req 4a.4 · 4b.3 — 100ms 이내 제거 계약).
   */
  setEffectSet(next: WeatherEffectSet): void {
    // 제거
    for (const id of Array.from(this.activeEffects.keys())) {
      if (!next.has(id)) {
        const effect = this.activeEffects.get(id)!;
        effect.reset();
        this.purgeEffectParticles(id);
        this.activeEffects.delete(id);
      }
    }
    // 추가
    for (const id of next) {
      if (!this.activeEffects.has(id)) {
        this.activeEffects.set(id, this.createEffect(id));
      }
    }
  }

  /** 최신 Weather_Snapshot 주입. 바람 벡터 · lightning 타이밍 등 런타임 파라미터 갱신. */
  setSnapshot(snapshot: Weather_Snapshot | null): void {
    this.snapshot = snapshot;
  }

  /** 파티클 예산 조회(테스트용). */
  getParticleBudget(): number {
    return this.particleBudget;
  }

  /** 예산 재설정(상위 훅이 `resolveParticleBudget` 재계산 시 호출). 예산 drop 플래그도 초기화된다. */
  setParticleBudget(next: number): void {
    if (!Number.isFinite(next) || next <= 0) return;
    this.particleBudget = Math.floor(next);
    this.budgetAlreadyDropped = false;
  }

  /** RAF 루프 실행 여부. */
  isRunning(): boolean {
    return this.running;
  }

  /** 풀 접근자(테스트용). 프로덕션 코드에서는 호출하지 말 것. */
  getParticlePoolForTesting(): ReadonlyArray<WeatherParticle> {
    return this.particlePool;
  }

  /** 활성 이펙트 id 조회(테스트용). */
  getActiveEffectIdsForTesting(): ReadonlyArray<WeatherEffectId> {
    return Array.from(this.activeEffects.keys());
  }

  // -----------------------------------------------------------------------
  // 내부 구현

  private readonly tick = (): void => {
    if (!this.running || !this.ctx) return;

    // resize·외부 버퍼 변경으로 transform 이 날아간 경우에도 매 프레임 복구.
    this.applyDprTransform();

    const frameStart = this.now();
    const delta = this.lastFrameAt === null ? 0 : frameStart - this.lastFrameAt;
    this.lastFrameAt = frameStart;

    // 한 프레임마다 clearRect + 각 이펙트 update → render.
    this.clearCanvas();

    const viewport = { width: this.getLogicalWidth(), height: this.getLogicalHeight() };
    const updateContext: EffectUpdateContext = {
      deltaMs: delta,
      snapshot: this.snapshot,
      viewport,
      particleBudget: this.particleBudget,
      particlePool: this.particlePool,
      now: frameStart,
    };
    for (const effect of this.activeEffects.values()) {
      effect.update(updateContext);
    }

    const renderContext: EffectRenderContext = {
      ctx: this.ctx,
      viewport,
      now: frameStart,
      particlePool: this.particlePool,
    };
    for (const effect of this.activeEffects.values()) {
      effect.render(renderContext);
    }

    // 예산 drop 검사(Req 5.6).
    const frameDuration = this.now() - frameStart;
    if (frameDuration > this.frameTimeBudgetMs) {
      this.consecutiveSlowFrames += 1;
      if (
        !this.budgetAlreadyDropped
        && this.consecutiveSlowFrames >= this.budgetDropFrameThreshold
      ) {
        this.particleBudget = Math.max(1, Math.floor(this.particleBudget * 0.5));
        this.budgetAlreadyDropped = true;
      }
    } else {
      this.consecutiveSlowFrames = 0;
    }

    this.frameHandle = this.requestFrame(this.tick);
  };

  private clearCanvas(): void {
    if (!this.ctx) return;
    // setTransform 이 적용된 상태에서 logical 좌표로 clearRect.
    this.ctx.clearRect(0, 0, this.getLogicalWidth(), this.getLogicalHeight());
  }

  private applyDprTransform(): void {
    if (!this.ctx) return;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private getLogicalWidth(): number {
    return this.canvas.width / this.dpr;
  }

  private getLogicalHeight(): number {
    return this.canvas.height / this.dpr;
  }

  private purgeEffectParticles(id: WeatherEffectId): void {
    switch (id) {
      case 'rain':
        RainEffect.purge(this.particlePool);
        break;
      case 'snow':
        SnowEffect.purge(this.particlePool);
        break;
      case 'dust':
        DustEffect.purge(this.particlePool);
        break;
      default:
        // 오버레이 기반 이펙트는 풀을 사용하지 않으므로 no-op.
        break;
    }
  }

  private createEffect(id: WeatherEffectId): Effect {
    switch (id) {
      case 'rain':
        return new RainEffect();
      case 'snow':
        return new SnowEffect();
      case 'dust':
        return new DustEffect();
      case 'fog':
        return new FogLayer();
      case 'smog':
        return new SmogLayer();
      case 'lightning':
        return new LightningOverlay();
      default: {
        // 방어적 분기: 알 수 없는 id 는 no-op 이펙트로 대체한다.
        const noop: Effect = {
          id,
          update: () => {},
          render: () => {},
          reset: () => {},
          getParticleCount: () => 0,
        };
        return noop;
      }
    }
  }
}
