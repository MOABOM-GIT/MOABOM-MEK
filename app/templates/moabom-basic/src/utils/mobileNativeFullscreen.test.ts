import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exitMobileNativeFullscreen,
  isAppleTouchDevice,
  isMobileNativeFullscreenActive,
  isMobileNativeFullscreenSupported,
  requestMobileNativeFullscreen,
} from './mobileNativeFullscreen';

describe('mobileNativeFullscreen', () => {
  const originalNavigator = globalThis.navigator;
  const originalDocument = globalThis.document;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: originalDocument,
    });
  });

  function mockNavigator(partial: Partial<Navigator> & { userAgent: string; platform?: string; maxTouchPoints?: number }) {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        ...partial,
        platform: partial.platform ?? 'Linux armv8l',
        maxTouchPoints: partial.maxTouchPoints ?? 0,
      },
    });
  }

  it('iPhone UA 는 Apple 터치 기기로 판별한다', () => {
    mockNavigator({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    expect(isAppleTouchDevice()).toBe(true);
    expect(isMobileNativeFullscreenSupported()).toBe(false);
  });

  it('iPadOS Macintosh UA 는 Apple 터치 기기로 판별한다', () => {
    mockNavigator({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    });
    expect(isAppleTouchDevice()).toBe(true);
  });

  it('Android + requestFullscreen 이 있으면 지원한다', () => {
    mockNavigator({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' });
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        documentElement: { requestFullscreen },
        fullscreenElement: null,
        exitFullscreen: vi.fn(),
      },
    });

    expect(isMobileNativeFullscreenSupported()).toBe(true);
  });

  it('requestMobileNativeFullscreen 성공 시 true 를 반환한다', async () => {
    mockNavigator({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' });
    const target = document.createElement('div');
    const requestFullscreen = vi.fn().mockImplementation(async function request(this: HTMLElement) {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        value: this,
      });
    });

    target.requestFullscreen = requestFullscreen;
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });

    await expect(requestMobileNativeFullscreen(target)).resolves.toBe(true);
    expect(requestFullscreen).toHaveBeenCalled();
    expect(isMobileNativeFullscreenActive()).toBe(true);
  });

  it('exitMobileNativeFullscreen 은 활성 상태일 때만 exit 를 호출한다', async () => {
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: document.createElement('div'),
    });
    document.exitFullscreen = exitFullscreen;

    await exitMobileNativeFullscreen();
    expect(exitFullscreen).toHaveBeenCalled();

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null,
    });
    exitFullscreen.mockClear();
    await exitMobileNativeFullscreen();
    expect(exitFullscreen).not.toHaveBeenCalled();
  });
});
