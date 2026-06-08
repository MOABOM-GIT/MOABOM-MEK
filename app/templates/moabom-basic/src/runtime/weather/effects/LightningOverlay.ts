import { LightningScheduler, type LightningFlashEvent, type LightningSchedulerOptions } from './LightningScheduler';
import type {
  Effect,
  EffectRenderContext,
  EffectUpdateContext,
} from '../Effect';

/**
 * 번개 플래시 오버레이(Req 4c.2 · 4c.3 · 4c.4).
 *
 * `LightningScheduler.tick()` 이 반환하는 `LightningFlashEvent` 를 기반으로 창(window) 구간에서만
 * 화면 전체를 백색으로 덮는다. 한 창 내부의 불투명도는 삼각파 형태(상승 → 감쇠) 로 `peakAlpha` 를 peak 에 한다.
 */
export class LightningOverlay implements Effect {
  readonly id = 'lightning' as const;
  private readonly scheduler: LightningScheduler;
  /** 현재 진행 중인 창(없으면 null). */
  private activeFlash: LightningFlashEvent | null = null;

  constructor(options?: LightningSchedulerOptions) {
    this.scheduler = new LightningScheduler(options);
  }

  update(context: EffectUpdateContext): void {
    const now = context.now;

    // 현재 창의 만료 검사.
    if (this.activeFlash && now - this.activeFlash.startAt >= this.activeFlash.durationMs) {
      this.activeFlash = null;
    }

    // 활성 창이 없으면 스케줄러에게 신규 창을 물어본다.
    if (!this.activeFlash) {
      const candidate = this.scheduler.tick();
      if (candidate) {
        this.activeFlash = candidate;
      }
    }
  }

  render(context: EffectRenderContext): void {
    const flash = this.activeFlash;
    if (!flash) return;
    const elapsed = context.now - flash.startAt;
    if (elapsed < 0 || elapsed >= flash.durationMs) return;

    // 0..1 정규화한 경과 시간에 대해 삼각파(peak at 0.5) 로 alpha 를 계산한다.
    const t = elapsed / flash.durationMs;
    const shape = t < 0.5 ? t * 2 : (1 - t) * 2;
    const alpha = Math.max(0, Math.min(flash.peakAlpha, shape * flash.peakAlpha));

    const { ctx, viewport } = context;
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    ctx.restore();
  }

  reset(): void {
    this.activeFlash = null;
    this.scheduler.reset();
  }

  getParticleCount(): number {
    return 0;
  }
}
