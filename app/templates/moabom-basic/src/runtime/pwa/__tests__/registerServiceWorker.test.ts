/**
 * Feature: moabom-pwa-service-worker
 *
 * `registerMoabomPwaServiceWorker` 의 no-op, 중복 등록 방지, waiting 이벤트 계약을 검증한다.
 *
 * Validates: Requirements 1.1, 1.4, 1.5, 7.1, 7.2
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const registerMock = vi.fn();
const addEventListenerMock = vi.fn();
const messageSkipWaitingMock = vi.fn();

vi.mock('workbox-window', () => ({
  Workbox: vi.fn().mockImplementation(function Workbox() {
    return {
      register: registerMock,
      addEventListener: addEventListenerMock,
      messageSkipWaiting: messageSkipWaitingMock,
    };
  }),
}));

describe('registerMoabomPwaServiceWorker', () => {
  let originalServiceWorker: unknown;

  beforeEach(async () => {
    vi.resetModules();
    registerMock.mockResolvedValue(undefined);
    registerMock.mockClear();
    addEventListenerMock.mockClear();
    messageSkipWaitingMock.mockClear();
    originalServiceWorker = navigator.serviceWorker;

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getRegistration: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalServiceWorker,
      configurable: true,
    });
  });

  it('navigator.serviceWorker 미지원 환경에서는 no-op 으로 종료한다', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      configurable: true,
    });

    const { registerMoabomPwaServiceWorker, resetMoabomPwaServiceWorkerRegistrationForTest } = await import('../registerServiceWorker');
    resetMoabomPwaServiceWorkerRegistrationForTest();

    await expect(registerMoabomPwaServiceWorker()).resolves.toBeUndefined();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('같은 페이지 수명주기에서 2회 호출되어도 Workbox register 는 1회만 호출된다', async () => {
    const { registerMoabomPwaServiceWorker, resetMoabomPwaServiceWorkerRegistrationForTest } = await import('../registerServiceWorker');
    resetMoabomPwaServiceWorkerRegistrationForTest();

    await registerMoabomPwaServiceWorker();
    await registerMoabomPwaServiceWorker();

    expect(registerMock).toHaveBeenCalledTimes(1);
  });

  it('waiting 이벤트는 커스텀 업데이트 이벤트만 발행하고 skipWaiting 은 호출하지 않는다', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const { registerMoabomPwaServiceWorker, resetMoabomPwaServiceWorkerRegistrationForTest } = await import('../registerServiceWorker');
    resetMoabomPwaServiceWorkerRegistrationForTest();

    await registerMoabomPwaServiceWorker();
    const waitingHandler = addEventListenerMock.mock.calls.find(([eventName]) => eventName === 'waiting')?.[1];
    expect(waitingHandler).toBeTypeOf('function');

    waitingHandler();

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'moabom-pwa-update-available' }));
    expect(messageSkipWaitingMock).not.toHaveBeenCalled();

    dispatchSpy.mockRestore();
  });
});
