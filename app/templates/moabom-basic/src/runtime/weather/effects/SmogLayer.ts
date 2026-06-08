import type {
  Effect,
  EffectRenderContext,
  EffectUpdateContext,
} from '../Effect';

/**
 * 스모그 이펙트 — 반투명 회갈색 오버레이(Req 4e.2 · 4e.3).
 *
 * Fog 와 유사하지만 색조와 상한 불투명도(0.4) 가 다르다.
 */
export class SmogLayer implements Effect {
  readonly id = 'smog' as const;
  private progress = 0;
  private readonly maxOpacity = 0.4;

  update(context: EffectUpdateContext): void {
    const deltaSec = Math.max(0, context.deltaMs / 1000);
    this.progress = Math.min(1, this.progress + deltaSec * 0.7);
  }

  render(context: EffectRenderContext): void {
    const { ctx, viewport } = context;
    const alpha = this.maxOpacity * this.progress;
    ctx.save();
    // 회갈색(#948068) 계열 — PM2.5 가 높을 때의 "탁하고 따뜻한" 톤.
    ctx.fillStyle = `rgba(148, 128, 104, ${alpha})`;
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    ctx.restore();
  }

  reset(): void {
    this.progress = 0;
  }

  getParticleCount(): number {
    return 0;
  }
}
