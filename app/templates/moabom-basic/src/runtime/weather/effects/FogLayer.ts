import type {
  Effect,
  EffectRenderContext,
  EffectUpdateContext,
} from '../Effect';

/**
 * 안개 이펙트 — 반투명 회색 그라디언트 오버레이(Req 4d.2 · 4d.3).
 *
 * 파티클을 사용하지 않고 `fillStyle` + `createLinearGradient` 로 그린다.
 * 최대 불투명도 0.5 를 넘지 않도록 상수로 제한한다.
 */
export class FogLayer implements Effect {
  readonly id = 'fog' as const;
  /** 페이드 인 진행도(0..1). 효과가 켜지는 첫 순간 시각적으로 부드럽게 나타나게 한다. */
  private progress = 0;
  private readonly maxOpacity = 0.5;

  update(context: EffectUpdateContext): void {
    const deltaSec = Math.max(0, context.deltaMs / 1000);
    this.progress = Math.min(1, this.progress + deltaSec * 0.8); // 약 1.25초 만에 최대치.
  }

  render(context: EffectRenderContext): void {
    const { ctx, viewport } = context;
    const alpha = this.maxOpacity * this.progress;
    ctx.save();
    const gradient = ctx.createLinearGradient(0, 0, 0, viewport.height);
    gradient.addColorStop(0, `rgba(200, 200, 200, ${alpha})`);
    gradient.addColorStop(1, `rgba(220, 220, 220, ${alpha * 0.8})`);
    ctx.fillStyle = gradient;
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
