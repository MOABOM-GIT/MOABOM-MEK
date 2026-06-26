/**
 * 홈 셸 지연 작업 큐 — 부트 파이프라인 단계별 idle 배치 SSOT.
 *
 * - secondary: presence·알림 unread·실시간 WS 등 2차 API
 * - tertiary-idle: 날씨·layout prefetch·랭킹·telemetry 등 3차 비긴급 작업
 */

import { whenMoabomBootPhaseAtLeast } from '../runtime/moabomShellBootPipeline';

type DeferredTask = () => void | Promise<void>;

let secondaryQueue: DeferredTask[] = [];
let secondaryFlushScheduled = false;
let tertiaryQueue: DeferredTask[] = [];
let tertiaryFlushScheduled = false;

function flushQueue(
  queue: DeferredTask[],
  resetScheduled: () => void,
): void {
  resetScheduled();
  const batch = queue.splice(0);
  for (const task of batch) {
    void task();
  }
}

function scheduleQueueFlush(
  queue: DeferredTask[],
  isScheduled: () => boolean,
  markScheduled: () => void,
  resetScheduled: () => void,
  delayMs: number,
  idleTimeoutMs: number,
): void {
  if (isScheduled()) {
    return;
  }
  markScheduled();

  const run = () => {
    window.setTimeout(() => flushQueue(queue, resetScheduled), delayMs);
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => run(), { timeout: idleTimeoutMs });
  } else {
    run();
  }
}

/** 2차 API — catalog-critical 이후 idle 배치 */
export function deferShellSecondaryWork(task: DeferredTask, delayMs = 400): void {
  secondaryQueue.push(task);

  whenMoabomBootPhaseAtLeast('secondary', () => {
    scheduleQueueFlush(
      secondaryQueue,
      () => secondaryFlushScheduled,
      () => { secondaryFlushScheduled = true; },
      () => { secondaryFlushScheduled = false; },
      delayMs,
      2000,
    );
  });
}

/** 3차 비긴급 — secondary 이후 tertiary-idle 단계 idle 배치 */
export function deferShellTertiaryWork(task: DeferredTask, delayMs = 600): void {
  tertiaryQueue.push(task);

  whenMoabomBootPhaseAtLeast('tertiary-idle', () => {
    scheduleQueueFlush(
      tertiaryQueue,
      () => tertiaryFlushScheduled,
      () => { tertiaryFlushScheduled = true; },
      () => { tertiaryFlushScheduled = false; },
      delayMs,
      3000,
    );
  });
}

export function resetShellDeferredWorkForTest(): void {
  secondaryQueue = [];
  secondaryFlushScheduled = false;
  tertiaryQueue = [];
  tertiaryFlushScheduled = false;
}
