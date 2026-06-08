import {
  countParticlesOfKind,
  removeParticlesOfKind,
  type Effect,
  type EffectRenderContext,
  type EffectUpdateContext,
  type WeatherParticle,
} from '../Effect';

/**
 * 비 이펙트 — 세로 하강 파티클 + 풍속·풍향 기반 수평 속도 벡터(Req 4a.2 · 4a.3).
 *
 * 공용 파티클 풀(`EffectUpdateContext.particlePool`) 에서 `kind === 'rain'` 인 항목만
 * 자신의 것으로 취급한다. 풀 공유로 GC 압박을 줄이고 효과 전환이 매끄러워진다.
 */
export class RainEffect implements Effect {
  readonly id = 'rain' as const;

  update(context: EffectUpdateContext): void {
    const { deltaMs, snapshot, viewport, particleBudget, particlePool } = context;
    const deltaSec = Math.max(0, deltaMs / 1000);

    const windSpeed = snapshot?.wind_speed_10m ?? 0;
    const windDirection = snapshot?.wind_direction_10m ?? 0;
    // Open-Meteo wind_direction 은 "바람이 오는 방향" 기준. 캔버스 좌표는 오른쪽 양수이므로
    // 비가 불 방향으로 밀려가도록 180° 회전한 뒤 sin 성분을 수평 속도로 삼는다.
    const rad = ((windDirection + 180) * Math.PI) / 180;
    const windVx = Math.sin(rad) * windSpeed * 8; // px/s, 감도 보정 계수.

    // 기존 파티클 이동 + 화면 밖 재활용.
    for (let i = 0; i < particlePool.length; i += 1) {
      const p = particlePool[i];
      if (p.kind !== 'rain') continue;
      p.x += (p.vx + windVx) * deltaSec;
      p.y += p.vy * deltaSec;
      if (p.y > viewport.height + 40 || p.x < -80 || p.x > viewport.width + 80) {
        p.y = -10;
        p.x = Math.random() * viewport.width;
      }
    }

    // 예산까지 파티클 보충.
    const target = Math.min(particleBudget, 260);
    const current = countParticlesOfKind(particlePool, 'rain');
    const toSpawn = Math.max(0, target - current);
    for (let i = 0; i < toSpawn; i += 1) {
      particlePool.push({
        kind: 'rain',
        x: Math.random() * viewport.width,
        y: Math.random() * viewport.height - viewport.height,
        vx: 0,
        vy: 600 + Math.random() * 400,
        size: 8 + Math.random() * 6,
        alpha: 0.6 + Math.random() * 0.3,
        phase: 0,
      });
    }
  }

  render(context: EffectRenderContext): void {
    const { ctx, particlePool } = context;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    for (let i = 0; i < particlePool.length; i += 1) {
      const p = particlePool[i];
      if (p.kind !== 'rain') continue;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y + p.size);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  reset(): void {
    // 엔진이 풀을 소유하므로, 정리는 static `purge(pool)` 로 위임한다.
  }

  getParticleCount(): number {
    // 풀 카운팅은 엔진이 소유한 배열을 기준으로 수행한다(테스트는 countParticlesOfKind 사용).
    return 0;
  }

  /** 엔진이 rain 을 Weather_Effect_Set 에서 제거할 때 풀에서 자신의 파티클만 제거한다. */
  static purge(pool: WeatherParticle[]): void {
    removeParticlesOfKind(pool, 'rain');
  }
}
