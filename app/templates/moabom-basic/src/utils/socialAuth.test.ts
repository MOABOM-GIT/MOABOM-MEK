import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchEnabledSocialProviders,
  getSocialAuthRedirectUrl,
  resetSocialAuthPopupBridge,
  resetSocialAuthProvidersCache,
  startSocialAuth,
  subscribeSocialAuthPopupMessages,
} from './socialAuth';

describe('socialAuth utils', () => {
  afterEach(() => {
    resetSocialAuthProvidersCache();
    resetSocialAuthPopupBridge();
    vi.unstubAllGlobals();
  });

  it('SNS 모듈 OAuth redirect URL을 생성한다', () => {
    expect(getSocialAuthRedirectUrl('kakao')).toBe('/api/modules/moabom-social-auth/kakao/redirect');
  });

  it('팝업 모드 SNS 모듈 OAuth redirect URL을 생성한다', () => {
    expect(getSocialAuthRedirectUrl('google', true)).toBe('/api/modules/moabom-social-auth/google/redirect?popup=1');
  });

  it('팝업 OAuth는 noopener 없이 URL과 함께 window.open을 호출한다', () => {
    const focus = vi.fn();
    const popup = { closed: false, focus };
    const open = vi.fn().mockReturnValue(popup);
    vi.stubGlobal('open', open);

    startSocialAuth('naver');

    expect(open).toHaveBeenCalledWith(
      '/api/modules/moabom-social-auth/naver/redirect?popup=1',
      'moabom-social-auth-naver',
      expect.not.stringContaining('noopener'),
    );
    expect(focus).toHaveBeenCalled();
  });

  it('팝업 차단 시 toast 오류를 표시한다', () => {
    const toast = { error: vi.fn() };
    vi.stubGlobal('open', vi.fn().mockReturnValue(null));
    (window as any).G7Core = { toast };

    startSocialAuth('google');

    expect(toast.error).toHaveBeenCalled();
  });

  it('popup postMessage를 구독자에게 전달한다', () => {
    const handler = vi.fn();
    const unsubscribe = subscribeSocialAuthPopupMessages(handler);

    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: {
        type: 'moabom-social-auth',
        status: 'success',
        code: 'exchange-code',
        provider: 'google',
      },
    }));

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success',
      code: 'exchange-code',
    }));

    unsubscribe();
  });

  it('활성화된 SNS provider 목록을 조회한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          providers: ['google', 'kakao'],
        },
      }),
    }));

    await expect(fetchEnabledSocialProviders()).resolves.toEqual(['google', 'kakao']);
    expect(fetch).toHaveBeenCalledWith('/api/modules/moabom-social-auth/providers', {
      headers: { Accept: 'application/json' },
    });
  });
});
