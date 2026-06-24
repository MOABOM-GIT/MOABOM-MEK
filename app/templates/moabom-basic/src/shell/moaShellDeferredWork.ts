/**
 * 홈 셸 — 로그인·presence 등 2차 작업을 idle+짧은 지연 후 실행해
 * 게시판·shell-boot·layout 선로드와 API 폭주를 피한다.
 */

type DeferredTask = () => void | Promise<void>;

let secondaryQueue: DeferredTask[] = [];
let secondaryFlushScheduled = false;

function flushSecondaryQueue(): void {
  secondaryFlushScheduled = false;
  const batch = secondaryQueue.splice(0);
  for (const task of batch) {
    void task();
  }
}

function scheduleSecondaryFlush(delayMs: number): void {
  if (secondaryFlushScheduled) {
    return;
  }
  secondaryFlushScheduled = true;

  const run = () => {
    window.setTimeout(flushSecondaryQueue, delayMs);
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => run(), { timeout: 2000 });
  } else {
    run();
  }
}

/** 비긴급 API(presence·공지 미리보기 등)를 한꺼번에 몰지 않도록 지연 실행 */
export function deferShellSecondaryWork(task: DeferredTask, delayMs = 400): void {
  secondaryQueue.push(task);
  scheduleSecondaryFlush(delayMs);
}

export function resetShellDeferredWorkForTest(): void {
  secondaryQueue = [];
  secondaryFlushScheduled = false;
}
