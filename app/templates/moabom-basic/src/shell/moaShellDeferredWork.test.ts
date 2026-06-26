import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deferShellSecondaryWork,
  deferShellTertiaryWork,
  resetShellDeferredWorkForTest,
} from './moaShellDeferredWork';
import {
  advanceMoabomBootPhase,
  resetMoabomShellBootPipelineForTest,
} from '../runtime/moabomShellBootPipeline';

describe('deferShellSecondaryWork', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetMoabomShellBootPipelineForTest();
    resetShellDeferredWorkForTest();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetMoabomShellBootPipelineForTest();
    resetShellDeferredWorkForTest();
  });

  it('secondary 단계 전에는 작업을 실행하지 않는다', () => {
    const task = vi.fn();

    deferShellSecondaryWork(task, 0);
    vi.runAllTimers();

    expect(task).not.toHaveBeenCalled();
  });

  it('secondary 단계 이후 idle 지연 뒤 작업을 실행한다', () => {
    const task = vi.fn();
    const ric = vi.fn((cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
    });
    vi.stubGlobal('requestIdleCallback', ric);

    deferShellSecondaryWork(task, 10);
    advanceMoabomBootPhase('secondary');

    vi.runAllTimers();

    expect(task).toHaveBeenCalledTimes(1);
  });
});

describe('deferShellTertiaryWork', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetMoabomShellBootPipelineForTest();
    resetShellDeferredWorkForTest();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetMoabomShellBootPipelineForTest();
    resetShellDeferredWorkForTest();
  });

  it('tertiary-idle 전에는 작업을 실행하지 않는다', () => {
    const task = vi.fn();

    deferShellTertiaryWork(task, 0);
    advanceMoabomBootPhase('secondary');
    vi.runAllTimers();

    expect(task).not.toHaveBeenCalled();
  });

  it('tertiary-idle 이후 idle 지연 뒤 작업을 실행한다', () => {
    const task = vi.fn();
    const ric = vi.fn((cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
    });
    vi.stubGlobal('requestIdleCallback', ric);

    deferShellTertiaryWork(task, 10);
    advanceMoabomBootPhase('tertiary-idle');

    vi.runAllTimers();

    expect(task).toHaveBeenCalledTimes(1);
  });
});
