import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MoabomSystemState } from '../types/moabomSystem';
import { DEFAULT_MOABOM_SYSTEM } from './moabomSystemStore';

// 테스트마다 신선한 모듈 상태가 필요하므로 동적 import 사용 전 모킹
vi.mock('../api/moabomSystemApi', () => {
  return {
    saveMoabomSystemSettings: vi.fn(),
  };
});

import { saveMoabomSystemSettings as mockedSave } from '../api/moabomSystemApi';
import {
  __resetMoabomSettingsSaveQueueForTest,
  getLastSaveRequestAt,
  getLastSaveResolveAt,
  isRecentlySavedSettings,
  isSavingSettings,
  queueSaveMoabomSystemSettings,
} from './moabomSettingsSaveQueue';

function mkState(pointColor: string): MoabomSystemState {
  return {
    ...DEFAULT_MOABOM_SYSTEM,
    appearance: { ...DEFAULT_MOABOM_SYSTEM.appearance, pointColor },
  };
}

/** 수동으로 resolve 제어 가능한 Promise */
function deferred<T = void>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('moabomSettingsSaveQueue', () => {
  beforeEach(() => {
    __resetMoabomSettingsSaveQueueForTest();
    vi.mocked(mockedSave).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('빠른 연속 호출 시 첫 요청과 마지막 요청만 전송된다(중간 상태는 건너뜀)', async () => {
    const first = deferred<any>();
    const second = deferred<any>();

    vi.mocked(mockedSave)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const a = mkState('#111111');
    const b = mkState('#222222');
    const c = mkState('#333333');

    const pA = queueSaveMoabomSystemSettings(a);
    const pB = queueSaveMoabomSystemSettings(b);
    const pC = queueSaveMoabomSystemSettings(c);

    // A 는 이미 in-flight, B/C 는 pending 으로 교체되며 결국 C 만 다음 요청이 된다
    expect(isSavingSettings()).toBe(true);
    expect(vi.mocked(mockedSave)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(mockedSave).mock.calls[0]?.[0]).toEqual(a);

    // 먼저 첫 번째 요청을 해결
    first.resolve({ ok: true });
    // 마이크로태스크 드레인 + 다음 드레인 진입 대기
    await Promise.resolve();
    await Promise.resolve();

    expect(vi.mocked(mockedSave)).toHaveBeenCalledTimes(2);
    // 두 번째로 전송된 건 B 가 아니라 C (가장 최신)
    expect(vi.mocked(mockedSave).mock.calls[1]?.[0]).toEqual(c);

    second.resolve({ ok: true });
    await pC;
    // 모든 반환된 Promise 는 flush 종료를 관찰한다
    await Promise.all([pA, pB, pC]);

    expect(isSavingSettings()).toBe(false);
  });

  it('in-flight 가 없을 때 호출은 즉시 새로운 요청을 시작한다', async () => {
    const first = deferred<any>();
    vi.mocked(mockedSave).mockReturnValueOnce(first.promise);

    const before = Date.now();
    const p = queueSaveMoabomSystemSettings(mkState('#abcdef'));

    expect(isSavingSettings()).toBe(true);
    expect(getLastSaveRequestAt()).toBeGreaterThanOrEqual(before);

    first.resolve({ ok: true });
    await p;

    expect(isSavingSettings()).toBe(false);
    expect(getLastSaveResolveAt()).toBeGreaterThanOrEqual(before);
  });

  it('isRecentlySavedSettings 는 저장 중에 true, 쿨다운 이후 false', async () => {
    vi.useFakeTimers();
    const first = deferred<any>();
    vi.mocked(mockedSave).mockReturnValueOnce(first.promise);

    const p = queueSaveMoabomSystemSettings(mkState('#abcdef'));

    // in-flight 중
    expect(isRecentlySavedSettings(500)).toBe(true);

    first.resolve({ ok: true });
    await p;

    // 방금 끝남 → 쿨다운 안
    expect(isRecentlySavedSettings(500)).toBe(true);

    // 쿨다운을 넘긴 시점
    vi.advanceTimersByTime(800);
    expect(isRecentlySavedSettings(500)).toBe(false);
  });

  it('PUT 실패는 조용히 스킵하고 후속 PUT 는 계속 진행된다', async () => {
    const first = deferred<any>();
    const second = deferred<any>();
    vi.mocked(mockedSave)
      .mockImplementationOnce(() => first.promise.then(() => { throw new Error('network'); }))
      .mockReturnValueOnce(second.promise);

    const pA = queueSaveMoabomSystemSettings(mkState('#111111'));
    const pB = queueSaveMoabomSystemSettings(mkState('#222222'));

    first.resolve(undefined);
    await Promise.resolve();
    await Promise.resolve();

    // 실패 후에도 pending(B) 요청이 발사됨
    expect(vi.mocked(mockedSave)).toHaveBeenCalledTimes(2);

    second.resolve({ ok: true });
    await pB;
    await pA;
    expect(isSavingSettings()).toBe(false);
  });
});
