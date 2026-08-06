import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  advanceMoabomBootPhase,
  awaitMoabomBootPhaseAtLeast,
  getMoabomBootPhase,
  isMoabomBootPhaseAtLeast,
  resetMoabomShellBootPipelineForTest,
  startMoabomShellBootPipeline,
  whenMoabomBootPhaseAtLeast,
} from './moabomShellBootPipeline';
import { MOABOM_BOOT_PHASE_CHANGED_EVENT } from '../i18n/moabomShellEvents';

vi.mock('./moabomShellBoot', () => ({
  ensureMoabomShellBootLoaded: vi.fn().mockResolvedValue(null),
}));

vi.mock('./moabomShellAuthPreload', () => ({
  ensureMoabomShellAuthPreloaded: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./moabomGeneratedAppLibraryLoad', () => ({
  awaitMoabomGeneratedAppLibraryPrefetch: vi.fn().mockResolvedValue(undefined),
  prefetchMoabomGeneratedAppLibrary: vi.fn(),
}));

vi.mock('./moabomUserShellState', () => ({
  prefetchMoabomUserShellState: vi.fn().mockResolvedValue(null),
}));

describe('moabomShellBootPipeline', () => {
  beforeEach(() => {
    resetMoabomShellBootPipelineForTest();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetMoabomShellBootPipelineForTest();
  });

  it('단계는 역행하지 않는다', () => {
    advanceMoabomBootPhase('document-ready');
    advanceMoabomBootPhase('shell-critical');
    advanceMoabomBootPhase('document-ready');

    expect(getMoabomBootPhase()).toBe('shell-critical');
  });

  it('isMoabomBootPhaseAtLeast 는 순서를 반영한다', () => {
    advanceMoabomBootPhase('catalog-critical');

    expect(isMoabomBootPhaseAtLeast('auth-ready')).toBe(true);
    expect(isMoabomBootPhaseAtLeast('secondary')).toBe(false);
  });

  it('whenMoabomBootPhaseAtLeast 는 이미 지난 단계면 즉시 실행한다', () => {
    advanceMoabomBootPhase('secondary');
    const task = vi.fn();

    whenMoabomBootPhaseAtLeast('catalog-critical', task);

    expect(task).toHaveBeenCalledTimes(1);
  });

  it('whenMoabomBootPhaseAtLeast 는 미래 단계면 advance 후 실행한다', () => {
    const task = vi.fn();

    whenMoabomBootPhaseAtLeast('secondary', task);
    expect(task).not.toHaveBeenCalled();

    advanceMoabomBootPhase('secondary');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('awaitMoabomBootPhaseAtLeast 는 단계 도달 시 resolve 한다', async () => {
    const pending = awaitMoabomBootPhaseAtLeast('handlers-ready');
    advanceMoabomBootPhase('handlers-ready');
    await expect(pending).resolves.toBeUndefined();
  });

  it('advance 시 커스텀 이벤트를 발행한다', () => {
    const handler = vi.fn();
    window.addEventListener(MOABOM_BOOT_PHASE_CHANGED_EVENT, handler);

    advanceMoabomBootPhase('document-ready');

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      type: MOABOM_BOOT_PHASE_CHANGED_EVENT,
      detail: { phase: 'document-ready' },
    }));

    window.removeEventListener(MOABOM_BOOT_PHASE_CHANGED_EVENT, handler);
  });

  it('startMoabomShellBootPipeline 은 DOMContentLoaded 후 auth-ready 까지 진행한다', async () => {
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: () => 'loading',
    });

    startMoabomShellBootPipeline();
    expect(getMoabomBootPhase()).toBe('sync');

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await vi.waitFor(() => {
      expect(isMoabomBootPhaseAtLeast('auth-ready')).toBe(true);
    });
  });
});
