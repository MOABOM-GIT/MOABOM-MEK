/**
 * Feature: moabom-pwa-service-worker
 *
 * Property 4: P-UpdateLifecycle — `waiting` 이벤트 반복 발생에도 토스트는 정확히 1개.
 *
 * Validates: Requirements 1.5, 7.3, 7.6, 10.5
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

import { useMoabomPwaUpdate } from '../usePwaUpdate';

vi.mock('../../../i18n/moabomT', () => ({
  moabomT: (key: string) => {
    const translations: Record<string, string> = {
      'moa_shell.pwa.update.message': '플랫폼이 업데이트 되었습니다.',
      'moa_shell.pwa.update.cta': '다시 불러오기',
    };
    return translations[key] ?? key;
  },
}));

vi.mock('../../../i18n/moabomTranslationOverlay', () => ({
  loadMoabomTranslationOverlay: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../utils/moabomSystemStore', () => ({
  loadMoabomSystemState: () => ({
    preferences: { language: 'ko' },
  }),
}));

describe('P4 P-UpdateLifecycle', () => {
  const enqueueMock = vi.fn();

  beforeEach(() => {
    enqueueMock.mockClear();
    (window as any).G7Core = {
      t: (key: string) => key,
      toast: {
        enqueue: enqueueMock,
      },
    };
  });

  afterEach(() => {
    delete (window as any).G7Core;
  });

  it('동일 lifecycle 에서 이벤트가 여러 번 발생해도 시스템 토스트는 정확히 1개만 발행된다', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 20 }), async (count) => {
        enqueueMock.mockClear();
        const { unmount } = renderHook(() => useMoabomPwaUpdate());

        await act(async () => {
          for (let i = 0; i < count; i++) {
            window.dispatchEvent(new CustomEvent('moabom-pwa-update-available'));
          }
          await Promise.resolve();
        });

        expect(enqueueMock).toHaveBeenCalledTimes(1);
        expect(enqueueMock).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'info',
            severity: 'system',
            duration: 0,
            message: '플랫폼이 업데이트 되었습니다.',
            action: expect.objectContaining({
              label: '다시 불러오기',
            }),
          }),
        );

        unmount();
      }),
      { numRuns: 30 },
    );
  }, 10000);

  it('CTA 실행 시 messageSkipWaiting 후 controllerchange 에서 reload 를 1회 호출한다', async () => {
    const messageSkipWaiting = vi.fn();
    const reload = vi.fn();
    const listeners = new Map<string, EventListener>();

    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      configurable: true,
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        addEventListener: vi.fn((eventName: string, listener: EventListener) => listeners.set(eventName, listener)),
        removeEventListener: vi.fn((eventName: string) => listeners.delete(eventName)),
      },
      configurable: true,
    });

    const { unmount } = renderHook(() => useMoabomPwaUpdate());

    await act(async () => {
      window.dispatchEvent(new CustomEvent('moabom-pwa-update-available', { detail: { wb: { messageSkipWaiting } } }));
      await Promise.resolve();
    });

    expect(enqueueMock).toHaveBeenCalledTimes(1);
    const action = enqueueMock.mock.calls[0]?.[0]?.action;
    const promise = action.onClick();

    expect(messageSkipWaiting).toHaveBeenCalledTimes(1);
    listeners.get('controllerchange')?.(new Event('controllerchange'));
    await promise;

    expect(reload).toHaveBeenCalledTimes(1);

    unmount();
  });
});
