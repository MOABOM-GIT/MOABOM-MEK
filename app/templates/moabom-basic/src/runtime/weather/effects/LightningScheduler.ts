/**
 * 한 번의 번개 플래시 창 파라미터(설계 §1.3).
 *
 * - `startAt` : 스케줄러가 창 개시를 알린 시각(ms). `now` 주입값과 동일 시계를 공유한다.
 * - `durationMs` : 80..120 사이 임의값(Req 4c.3).
 * - `peakAlpha` : 0..0.4 사이 임의값(Req 4c.3).
 */
export interface LightningFlashEvent {
  startAt: number;
  durationMs: number;
  peakAlpha: number;
}

export interface LightningSchedulerOptions {
  /** 분당 하한 횟수(기본 1, Req 4c.2). */
  minPerMinute?: number;
  /** 분당 상한 횟수(기본 3, Req 4c.2). */
  maxPerMinute?: number;
  /** 두 연속 flash 의 최소 간격(ms, 기본 15000, Req 4c.4). */
  minIntervalMs?: number;
  /** 창 지속 시간 하한(ms, 기본 80, Req 4c.3). */
  minDurationMs?: number;
  /** 창 지속 시간 상한(ms, 기본 120, Req 4c.3). */
  maxDurationMs?: number;
  /** 최대 불투명도 상한(0..1, 기본 0.4, Req 4c.3). */
  maxPeakAlpha?: number;
  /** 난수 공급자(테스트 주입 가능, 기본 Math.random). */
  random?: () => number;
  /** 시계 주입(테스트 가상 시계), 기본 performance.now. */
  now?: () => number;
}

const DEFAULTS = {
  minPerMinute: 1,
  maxPerMinute: 3,
  minIntervalMs: 15_000,
  minDurationMs: 80,
  maxDurationMs: 120,
  maxPeakAlpha: 0.4,
} as const;

/**
 * 번개 플래시 창의 빈도 · 간격 · 길이 · 불투명도를 통제하는 결정적 스케줄러(설계 §1.3).
 *
 * 불변식(Property 5 — P-LightningCadence, 한 시간 이상 누적):
 *  - 분당 횟수 상한 ≤ maxPerMinute (모든 연속 60 s 창)
 *  - 분당 횟수 하한 ≥ minPerMinute (평균 기준 — 초기 워밍업 구간 고려)
 *  - 연속 두 창의 `startAt` 차이 ≥ minIntervalMs
 *  - `durationMs ∈ [minDurationMs, maxDurationMs]`, `peakAlpha ∈ [0, maxPeakAlpha]`
 *
 * 다음 예정 시각 샘플링 방식: `minIntervalMs` + U(0, extraWindow) 로 포아송 유사 분포를 만들되,
 * `extraWindow` 는 `60s - minIntervalMs` 를 `maxPerMinute - 1` 로 나눈 값으로 설정해
 * 최악의 경우에도 분당 상한을 넘기지 않도록 한다.
 */
export class LightningScheduler {
  private readonly minPerMinute: number;
  private readonly maxPerMinute: number;
  private readonly minIntervalMs: number;
  private readonly minDurationMs: number;
  private readonly maxDurationMs: number;
  private readonly maxPeakAlpha: number;
  private readonly random: () => number;
  private readonly now: () => number;

  /** 마지막 창이 개시된 시각(ms). -1 이면 아직 한 번도 안 친 상태. */
  private lastAt = -1;
  /** 다음 창이 개시될 예정 시각(ms). 초기에는 첫 호출 시 설정된다. */
  private nextAt = -1;
  /** 직전 60s 윈도우에 발생한 창들의 시각 타임스탬프 버퍼(상한 체크용). */
  private readonly recentWindow: number[] = [];

  constructor(options: LightningSchedulerOptions = {}) {
    this.minPerMinute = options.minPerMinute ?? DEFAULTS.minPerMinute;
    this.maxPerMinute = options.maxPerMinute ?? DEFAULTS.maxPerMinute;
    this.minIntervalMs = options.minIntervalMs ?? DEFAULTS.minIntervalMs;
    this.minDurationMs = options.minDurationMs ?? DEFAULTS.minDurationMs;
    this.maxDurationMs = options.maxDurationMs ?? DEFAULTS.maxDurationMs;
    this.maxPeakAlpha = options.maxPeakAlpha ?? DEFAULTS.maxPeakAlpha;
    this.random = options.random ?? Math.random;
    this.now = options.now ?? (() => performance.now());

    if (this.minPerMinute < 1) this.minPerMinute = 1;
    if (this.maxPerMinute < this.minPerMinute) this.maxPerMinute = this.minPerMinute;
    if (this.minIntervalMs < 0) this.minIntervalMs = 0;
  }

  /**
   * 현재 시각이 다음 예정 시각에 도달했다면 새 `LightningFlashEvent` 를 반환하고,
   * 아니면 null 을 돌려준다. 엔진은 매 프레임마다 호출한다.
   */
  tick(): LightningFlashEvent | null {
    const current = this.now();

    if (this.nextAt < 0) {
      // 첫 호출 — 최소 간격 안에서 무작위로 첫 창 예약(Req 4c.2 빈도 보장을 위해 1분 이내).
      this.nextAt = current + this.sampleFirstDelayMs();
      return null;
    }

    if (current < this.nextAt) return null;

    // 최소 간격 검사(이중 안전망).
    if (this.lastAt >= 0 && (current - this.lastAt) < this.minIntervalMs) {
      // 간격이 부족하면 minIntervalMs 만큼 밀어내고 대기.
      this.nextAt = this.lastAt + this.minIntervalMs;
      return null;
    }

    // 60s 윈도우 내 상한 검사.
    this.trimRecentWindow(current);
    if (this.recentWindow.length >= this.maxPerMinute) {
      // 윈도우 첫 항목이 나갈 때까지 대기.
      this.nextAt = this.recentWindow[0] + 60_000 + 1;
      return null;
    }

    const event: LightningFlashEvent = {
      startAt: current,
      durationMs: this.sampleDurationMs(),
      peakAlpha: this.samplePeakAlpha(),
    };

    this.lastAt = current;
    this.recentWindow.push(current);
    this.nextAt = current + this.sampleNextIntervalMs();
    return event;
  }

  /** 비활성화 전이 시 호출. */
  reset(): void {
    this.lastAt = -1;
    this.nextAt = -1;
    this.recentWindow.length = 0;
  }

  /** 첫 창 지연 — 0..(60s / maxPerMinute) 범위의 난수. */
  private sampleFirstDelayMs(): number {
    const slot = 60_000 / this.maxPerMinute;
    return Math.max(0, Math.min(slot, this.random() * slot));
  }

  /**
   * 다음 간격 샘플링 — `[minIntervalMs, minIntervalMs + extraWindow]` 범위의 균등 분포.
   *
   * `extraWindow = max(0, (60s / maxPerMinute) - minIntervalMs)` 로 잡아,
   * 연속 발생 평균이 `60s / maxPerMinute` 를 넘도록 한다(상한 보장).
   * 동시에 `minPerMinute >= 1` 이므로 최대 간격도 60s 이하.
   */
  private sampleNextIntervalMs(): number {
    const slot = 60_000 / this.maxPerMinute;
    const extra = Math.max(0, slot - this.minIntervalMs);
    return this.minIntervalMs + this.random() * extra;
  }

  private sampleDurationMs(): number {
    const span = this.maxDurationMs - this.minDurationMs;
    return this.minDurationMs + this.random() * span;
  }

  private samplePeakAlpha(): number {
    return this.random() * this.maxPeakAlpha;
  }

  /** 60s 윈도우 밖으로 벗어난 항목을 버린다. */
  private trimRecentWindow(now: number): void {
    while (this.recentWindow.length > 0 && now - this.recentWindow[0] >= 60_000) {
      this.recentWindow.shift();
    }
  }
}
