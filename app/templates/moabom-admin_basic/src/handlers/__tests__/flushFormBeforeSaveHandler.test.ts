import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushFormBeforeSaveHandler } from '../flushFormBeforeSaveHandler';

describe('flushFormBeforeSaveHandler', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('활성 input 을 blur 한다', async () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const blurSpy = vi.spyOn(input, 'blur');
    await flushFormBeforeSaveHandler();

    expect(blurSpy).toHaveBeenCalledTimes(1);
  });
});
