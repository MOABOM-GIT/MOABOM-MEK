import { describe, expect, it, vi } from 'vitest';

import {
  claimAiGenerationBusy,
  isAiGenerationBusy,
  releaseAiGenerationBusy,
  setAiGenerationBusy,
  subscribeAiGenerationBusy,
} from 'moabom-ai-generation-activity';

describe('aiGenerationActivity', () => {
  it('생성 중 busy 상태를 구독자에게 전달한다', () => {
    setAiGenerationBusy(false);
    const listener = vi.fn();
    const unsubscribe = subscribeAiGenerationBusy(listener);

    setAiGenerationBusy(true);
    expect(isAiGenerationBusy()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    setAiGenerationBusy(true);
    expect(listener).toHaveBeenCalledTimes(1);

    setAiGenerationBusy(false);
    expect(isAiGenerationBusy()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it('다른 owner의 release는 busy를 해제하지 않는다', () => {
    setAiGenerationBusy(false);
    const ownerA = Symbol('a');
    const ownerB = Symbol('b');

    claimAiGenerationBusy(ownerA);
    expect(isAiGenerationBusy()).toBe(true);

    releaseAiGenerationBusy(ownerB);
    expect(isAiGenerationBusy()).toBe(true);

    releaseAiGenerationBusy(ownerA);
    expect(isAiGenerationBusy()).toBe(false);
  });
});
