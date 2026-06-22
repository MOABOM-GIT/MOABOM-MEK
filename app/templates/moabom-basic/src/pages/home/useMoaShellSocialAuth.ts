import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type { AuthWindowMode } from '../../components/composite/Moa_AuthWindowContent';
import { subscribeSocialAuthPopupMessages, type SocialAuthPopupMessage } from '../../utils/socialAuth';
import type { MoabomTranslateFn } from '../../i18n/moabomT';
import type { AuthUserLike } from '../../shell/moaShellTypes';

export interface UseMoaShellSocialAuthOptions {
  t: MoabomTranslateFn;
  isLoggedInRef: MutableRefObject<boolean>;
  applyAuthState: (authenticated: boolean, user: AuthUserLike | null | undefined) => void;
  closeAuthWindows: () => void;
  openAuthWindow: (mode: AuthWindowMode) => void;
}

export function useMoaShellSocialAuth({
  t,
  isLoggedInRef,
  applyAuthState,
  closeAuthWindows,
  openAuthWindow,
}: UseMoaShellSocialAuthOptions) {
  const socialAuthHandledRef = useRef(false);

  const exchangeSocialAuthCode = useCallback(async (socialAuthCode: string) => {
    try {
      const response = await fetch('/api/modules/moabom-social-auth/exchange', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: socialAuthCode }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t('moa_shell.home.sns_login_failed'));
      }

      const G7Core = (window as { G7Core?: { api?: { setToken?: (token: string) => void }; AuthManager?: { getInstance?: () => { checkAuth?: (type: string) => Promise<boolean>; getUser?: () => AuthUserLike | null } }; toast?: { success?: (msg: string, ms: number) => void } } }).G7Core;
      G7Core?.api?.setToken?.(payload.data.token);

      const authManager = G7Core?.AuthManager?.getInstance?.();
      if (authManager?.checkAuth) {
        const authenticated = await authManager.checkAuth('user');
        const user = authenticated ? authManager.getUser?.() : payload.data.user;
        applyAuthState(true, user);
      } else {
        applyAuthState(true, payload.data.user);
      }

      closeAuthWindows();
      G7Core?.toast?.success?.(t('moa_shell.home.sns_login_success'), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('moa_shell.home.sns_login_failed');
      (window as { G7Core?: { toast?: { error?: (msg: string, ms: number) => void } } }).G7Core?.toast?.error?.(message, 5000);
      if (!isLoggedInRef.current) {
        openAuthWindow('login');
      }
    }
  }, [applyAuthState, closeAuthWindows, isLoggedInRef, openAuthWindow, t]);

  useEffect(() => {
    const handleSocialAuthMessage = (data: SocialAuthPopupMessage) => {
      if (data.status === 'error') {
        (window as { G7Core?: { toast?: { error?: (msg: string, ms: number) => void } } }).G7Core?.toast?.error?.(data.error || t('moa_shell.home.sns_login_failed'), 5000);
        if (!isLoggedInRef.current) {
          openAuthWindow('login');
        }
        return;
      }

      if (!data.code) {
        (window as { G7Core?: { toast?: { error?: (msg: string, ms: number) => void } } }).G7Core?.toast?.error?.(t('moa_shell.home.sns_exchange_invalid'), 5000);
        if (!isLoggedInRef.current) {
          openAuthWindow('login');
        }
        return;
      }

      void exchangeSocialAuthCode(data.code);
    };

    return subscribeSocialAuthPopupMessages(handleSocialAuthMessage);
  }, [exchangeSocialAuthCode, isLoggedInRef, openAuthWindow, t]);

  useEffect(() => {
    if (socialAuthHandledRef.current) return;
    socialAuthHandledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const socialAuthError = params.get('social_auth_error');
    const socialAuthCode = params.get('social_auth_code');

    if (!socialAuthError && !socialAuthCode) return;

    const cleanUrl = `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState({}, '', cleanUrl || '/');

    if (socialAuthError) {
      const G7Core = (window as { G7Core?: { toast?: { error?: (msg: string, ms: number) => void } } }).G7Core;
      G7Core?.toast?.error?.(socialAuthError, 5000);
      if (!isLoggedInRef.current) {
        openAuthWindow('login');
      }
      return;
    }

    if (!socialAuthCode) return;

    void exchangeSocialAuthCode(socialAuthCode);
  }, [exchangeSocialAuthCode, isLoggedInRef, openAuthWindow]);
}
