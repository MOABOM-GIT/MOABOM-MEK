import React, { useEffect, useState } from 'react';
import { Div } from '../basic/Div';
import { Button } from '../basic/Button';
import { Icon } from '../basic/Icon';
import { Span } from '../basic/Span';
import { Svg } from '../basic/Svg';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import { fetchEnabledSocialProviders, startSocialAuth } from '../../utils/socialAuth';
import { useMoabomSiteDisplayName } from '../../utils/moabomSiteBranding';
import type { AuthWindowMode } from './Moa_AuthWindowContent';

interface LoginPromptProps {
  onOpenAuth?: (mode: AuthWindowMode) => void;
}

/**
 * LoginPrompt 컴포넌트
 *
 * 비로그인 상태에서 우측 패널에 표시되는 로그인 프롬프트 카드입니다.
 * SNS 로그인 버튼 (구글, 네이버, 카카오)을 포함합니다.
 */
export const LoginPrompt: React.FC<LoginPromptProps> = ({ onOpenAuth }) => {
  const { t } = useMoabomShellT();
  const siteDisplayName = useMoabomSiteDisplayName();
  const [enabledProviders, setEnabledProviders] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadProviders = async () => {
      const providers = await fetchEnabledSocialProviders();
      if (mounted) {
        setEnabledProviders(providers);
      }
    };

    void loadProviders();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Div className="login-prompt-card glass-sm absolute inset-[7px] z-50 flex flex-col justify-center items-center p-8 rounded-[17px] text-center">
      {/* 로켓 아이콘 */}
      <Div
        className="relative w-[84px] h-[84px] rounded-[26px] inline-flex items-center justify-center text-white mb-6 z-10"
        style={{
          background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
          boxShadow: '0 15px 35px rgba(108, 92, 231, 0.4)',
        }}
      >
        <Icon name="rocket" className="rocket-icon text-white" />
      </Div>

      {/* 타이틀 */}
      <Div className="text-3xl font-bold mb-2.5 tracking-tight leading-tight text-heading">
        {t('moa_shell.login_prompt.title_line1')}
        <br />
        {t('moa_shell.login_prompt.title_line2')}
      </Div>

      <Div className="text-base font-bold mb-3" style={{ color: 'var(--moa-point-color)' }}>
        {siteDisplayName}
      </Div>

      {/* 설명 */}
      <Div className="text-base text-secondary mb-6 leading-tight">
        {t('moa_shell.login_prompt.desc_line1')}
        <br />
        {t('moa_shell.login_prompt.desc_line2')}
      </Div>

      <Div className="w-full max-w-[280px] flex flex-col gap-[7px] z-10 mb-3">
        <Button
          type="button"
          variant="primary"
          size="medium"
          onClick={() => onOpenAuth?.('login')}
          className="w-full h-[45px] text-sm"
        >
          <Icon name="envelope" />
          {t('moa_shell.login_prompt.email_login')}
        </Button>
      </Div>

      {enabledProviders.length > 0 && (
        <>
        <Div className="w-full max-w-[280px] my-3 flex items-center gap-3 z-10">
          <Div className="h-px flex-1 bg-slate-400/40 dark:bg-slate-500/45" />
          <Span className="text-xs font-bold text-muted">{t('moa_shell.login_prompt.sns_label')}</Span>
          <Div className="h-px flex-1 bg-slate-400/40 dark:bg-slate-500/45" />
        </Div>
        <Div className="w-full max-w-[280px] flex flex-col gap-[7px] z-10">
          {enabledProviders.includes('google') && (
            <Button
              type="button"
              onClick={() => startSocialAuth('google')}
              className="social-login-btn social-google social_link w-full h-[45px] flex items-center justify-center gap-2 px-3 cursor-pointer"
              style={{
                borderRadius: '0.9rem',
                background: 'rgba(255,255,255,0.8)',
                border: 'solid 1px #eee',
                boxShadow: '0 8px 13px -3px rgba(0,0,0,0.07), 0 3px 5px -3px rgba(0,0,0,0.07)',
              }}
            >
              <Div className="w-5 h-5 flex items-center justify-center shrink-0">
                <Svg viewBox="0 0 48 48" width={20} height={20} style={{ display: 'block' }}>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  <path fill="none" d="M0 0h48v48H0z" />
                </Svg>
              </Div>
              <Span className="text-sm font-bold text-[#1f1f1f]">{t('moa_shell.login_prompt.social_google')}</Span>
            </Button>
          )}

          {enabledProviders.includes('naver') && (
            <Button
              type="button"
              onClick={() => startSocialAuth('naver')}
              className="social-login-btn social-naver social_link w-full h-[45px] flex items-center justify-center gap-2 px-3 cursor-pointer"
              style={{
                borderRadius: '0.9rem',
                background: 'rgba(3,169,77,0.8)',
                border: 'solid 1px #03a94d',
                boxShadow: '0 8px 13px -3px rgba(0,0,0,0.07), 0 3px 5px -3px rgba(0,0,0,0.07)',
              }}
            >
              <Div className="w-4 h-4 flex items-center justify-center shrink-0">
                <Svg viewBox="0 0 48 48" width={15} height={15} style={{ display: 'block' }}>
                  <path fill="#FFFFFF" d="M32.5,25.7L14.7,0H0v48h15.5V22.3L33.2,48H48V0H32.5V25.7z" />
                </Svg>
              </Div>
              <Span className="text-sm font-bold text-white">{t('moa_shell.login_prompt.social_naver')}</Span>
            </Button>
          )}

          {enabledProviders.includes('kakao') && (
            <Button
              type="button"
              onClick={() => startSocialAuth('kakao')}
              className="social-login-btn social-kakao social_link w-full h-[45px] flex items-center justify-center gap-2 px-3 cursor-pointer"
              style={{
                borderRadius: '0.9rem',
                background: 'rgba(254,229,0,0.8)',
                border: 'solid 1px #fee500',
                boxShadow: '0 8px 13px -3px rgba(0,0,0,0.07), 0 3px 5px -3px rgba(0,0,0,0.07)',
              }}
            >
              <Div className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
                <Svg viewBox="0 0 48 48" width={18} height={18} style={{ display: 'block' }}>
                  <path fill="#1A1807" d="M24,1.5C10.7,1.5,0,9.8,0,20.1c0,6.4,4.2,12,10.5,15.4l-2.7,9.8c-0.2,0.9,0.7,1.6,1.5,1.1L21,38.6c1,0.1,2,0.2,3,0.2c13.3,0,24-8.3,24-18.6C48,9.8,37.3,1.5,24,1.5" />
                </Svg>
              </Div>
              <Span className="text-sm font-bold text-[#1a1807]">{t('moa_shell.login_prompt.social_kakao')}</Span>
            </Button>
          )}
        </Div>
        </>
      )}
    </Div>
  );
};
