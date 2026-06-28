type TaskEntry<T> = {
  promise: Promise<T>;
  timer: ReturnType<typeof setTimeout> | null;
};

const inFlight = new Map<string, Promise<unknown>>();
const scheduled = new Map<string, TaskEntry<unknown>>();
const lastStartedAt = new Map<string, number>();

export type ShellRealtimeTaskOptions = {
  minIntervalMs?: number;
};

/**
 * 실시간 이벤트·포커스 복귀·폴링이 같은 REST 자원을 동시에 당기지 않도록 key 단위로 합칩니다.
 */
export function runMoabomShellRealtimeTask<T>(
  key: string,
  task: () => Promise<T>,
  options: ShellRealtimeTaskOptions = {},
): Promise<T> {
  const active = inFlight.get(key);
  if (active) {
    return active as Promise<T>;
  }

  const pending = scheduled.get(key);
  if (pending) {
    return pending.promise as Promise<T>;
  }

  const minIntervalMs = options.minIntervalMs ?? 250;
  const elapsed = Date.now() - (lastStartedAt.get(key) ?? 0);
  const delayMs = Math.max(0, minIntervalMs - elapsed);

  const start = (): Promise<T> => {
    scheduled.delete(key);
    lastStartedAt.set(key, Date.now());

    let promise: Promise<T>;
    promise = task().finally(() => {
      if (inFlight.get(key) === promise) {
        inFlight.delete(key);
      }
    });
    inFlight.set(key, promise);

    return promise;
  };

  if (delayMs <= 0) {
    return start();
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const promise = new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      timer = null;
      start().then(resolve, reject);
    }, delayMs);
  });
  const entry: TaskEntry<T> = { promise, timer };
  scheduled.set(key, entry as TaskEntry<unknown>);

  return entry.promise;
}

export function resetMoabomShellRealtimeRequestCoalescerForTest(): void {
  scheduled.forEach(entry => {
    if (entry.timer) {
      clearTimeout(entry.timer);
    }
  });
  scheduled.clear();
  inFlight.clear();
  lastStartedAt.clear();
}
