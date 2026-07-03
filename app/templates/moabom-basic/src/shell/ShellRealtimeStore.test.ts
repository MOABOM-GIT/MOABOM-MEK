import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  handleShellPresenceRevisionEvent,
  registerShellPresenceInvalidate,
  resetShellRealtimeStoreForTest,
  scheduleShellPresenceCatchUp,
} from './ShellRealtimeStore';

describe('ShellRealtimeStore', () => {
  afterEach(() => {
    vi.useRealTimers();
    resetShellRealtimeStoreForTest();
  });

  it('revision debounce 후 reason 기반 targets 를 전달한다', () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    registerShellPresenceInvalidate(handler);

    handleShellPresenceRevisionEvent({
      tenant_slug: 'acme',
      revision: 2,
      reason: 'friendship_accepted',
    });

    expect(handler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(handler).toHaveBeenCalledWith({
      summary: false,
      online: true,
      friends: true,
    });
  });

  it('catch-up 은 ws_reconnect targets 로 coalesce 된다', () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    registerShellPresenceInvalidate(handler);

    scheduleShellPresenceCatchUp();
    vi.advanceTimersByTime(300);

    expect(handler).toHaveBeenCalledWith({
      summary: true,
      online: true,
      friends: false,
    });
  });
});
