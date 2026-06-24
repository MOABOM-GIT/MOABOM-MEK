import { describe, expect, it, vi } from 'vitest';
import {
  extractHttpStatusFromError,
  isTransientHttpStatus,
  withTransientRetry,
} from '../moaShellTransientRetry';

describe('moaShellTransientRetry', () => {
  it('isTransientHttpStatus 가 502·503·504·429 를 인식한다', () => {
    expect(isTransientHttpStatus(502)).toBe(true);
    expect(isTransientHttpStatus(503)).toBe(true);
    expect(isTransientHttpStatus(404)).toBe(false);
  });

  it('withTransientRetry 가 일시 오류 후 성공한다', async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('bad'), { status: 502 }))
      .mockResolvedValueOnce('ok');

    const promise = withTransientRetry(fn, { baseDelayMs: 100 });
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('extractHttpStatusFromError 가 response.status 를 읽는다', () => {
    expect(extractHttpStatusFromError({ response: { status: 503 } })).toBe(503);
  });
});
