import {
  countParticlesOfKind,
  removeParticlesOfKind,
  type Effect,
  type EffectRenderContext,
  type EffectUpdateContext,
  type WeatherParticle,
} from '../Effect';

/**
 * 눈 이펙트 — 좌우로 흔들리며 하강하는 파티클(Req 4b.2).
 *
 * 각 파티클은 자체 `phase` 를 가지며, sin 함수로 수평 흔들림을 계산한다.
 * 풍속이 있으면 전체 수평 편향을 추가한다.
 */
export class SnowEffect implements Effect {
  readonly id = 'snow' as const;

  update(context: EffectUpdateContext): void {
    const { deltaMs, snapshot, viewport, particleBudget, particlePool } = context;
    const deltaSec = Math.max(0, deltaMs / 1000);

    const windSpeed = snapshot?.wind_speed_10m ?? 0;
    const windDirection = snapshot?.wind_direction_10m ?? 0;
    const rad = ((windDirection + 180) * Math.PI) / 180;
    const windVx = Math.sin(rad) * windSpeed * 4;

    for (let i = 0; i < particlePool.length; i += 1) {
      const p = particlePool[i];
      if (p.kind !== 'snow') continue;
      p.phase += deltaSec * 1.5;
      const swayVx = Math.sin(p.phase) * 20; // ±20px/s 수평 흔들림.
      p.x += (swayVx + windVx) * deltaSec;
      p.y += p.vy * deltaSec;
      if (p.y > viewport.height + 10 || p.x < -40 || p.x > viewport.width + 40) {
        p.y = -p.size;
        p.x = Math.random() * viewport.width;
      }
    }

    const target = Math.min(particleBudget, 220);
    const current = countParticlesOfKind(particlePool, 'snow');
    const toSpawn = Math.max(0, target - current);
    for (let i = 0; i < toSpawn; i += 1) {
      particlePool.push({
        kind: 'snow',
        x: Math.random() * viewport.width,
        y: Math.random() * viewport.height - viewport.height,
        vx: 0,
        vy: 40 + Math.random() * 70, // 40..110 px/s 낙하.
        size: 1.5 + Math.random() * 2.5,
        alpha: 0.7 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  render(context: EffectRenderContext): void {
    const { ctx, particlePool } = context;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    for (let i = 0; i < particlePool.length; i += 1) {
      const p = particlePool[i];
      if (p.kind !== 'snow') continue;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  reset(): void {}

  getParticleCount(): number {
    return 0;
  }

  static purge(pool: WeatherParticle[]): void {
    removeParticlesOfKind(pool, 'snow');
  }
}
