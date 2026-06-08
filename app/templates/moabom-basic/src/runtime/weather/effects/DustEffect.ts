import {
  countParticlesOfKind,
  removeParticlesOfKind,
  type Effect,
  type EffectRenderContext,
  type EffectUpdateContext,
  type WeatherParticle,
} from '../Effect';

/**
 * 황사 이펙트 — 노란빛 모래 파티클이 바람 방향으로 흘러간다(Req 4f.2 · 4f.3).
 *
 * 비·눈보다 낮은 수직 속도와 큰 수평 속도를 쓴다. 풍속이 0 이어도 기본 흐름을 유지한다.
 */
export class DustEffect implements Effect {
  readonly id = 'dust' as const;

  update(context: EffectUpdateContext): void {
    const { deltaMs, snapshot, viewport, particleBudget, particlePool } = context;
    const deltaSec = Math.max(0, deltaMs / 1000);

    const windSpeed = snapshot?.wind_speed_10m ?? 0;
    const windDirection = snapshot?.wind_direction_10m ?? 0;
    const rad = ((windDirection + 180) * Math.PI) / 180;
    const windVx = Math.sin(rad) * windSpeed * 12; // 황사는 바람에 민감하게 반응.

    for (let i = 0; i < particlePool.length; i += 1) {
      const p = particlePool[i];
      if (p.kind !== 'dust') continue;
      p.phase += deltaSec * 0.8;
      const drift = Math.sin(p.phase) * 10;
      p.x += (p.vx + windVx + drift) * deltaSec;
      p.y += p.vy * deltaSec;
      if (p.y > viewport.height + 20 || p.x < -60 || p.x > viewport.width + 60) {
        p.y = Math.random() * viewport.height * 0.6; // 상단 60% 영역에 재배치.
        p.x = windVx >= 0 ? -20 : viewport.width + 20; // 바람 방향 반대편에서 진입.
      }
    }

    const target = Math.min(particleBudget, 180);
    const current = countParticlesOfKind(particlePool, 'dust');
    const toSpawn = Math.max(0, target - current);
    for (let i = 0; i < toSpawn; i += 1) {
      particlePool.push({
        kind: 'dust',
        x: Math.random() * viewport.width,
        y: Math.random() * viewport.height * 0.7,
        vx: 30 + Math.random() * 40, // 기본 오른쪽 흐름.
        vy: 8 + Math.random() * 16, // 약한 수직 낙하.
        size: 1.2 + Math.random() * 2,
        alpha: 0.25 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  render(context: EffectRenderContext): void {
    const { ctx, particlePool } = context;
    ctx.save();
    // 황사 톤: 노란 샌드 컬러(#e0b060 계열) · 낮은 불투명도로 겹겹이 쌓이게.
    ctx.fillStyle = 'rgba(224, 176, 96, 1)';
    for (let i = 0; i < particlePool.length; i += 1) {
      const p = particlePool[i];
      if (p.kind !== 'dust') continue;
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
    removeParticlesOfKind(pool, 'dust');
  }
}
