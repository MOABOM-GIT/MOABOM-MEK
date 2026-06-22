import React, { useEffect, useMemo, useState } from 'react';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import { coreSyncLanguageFromMoabomPref } from '../../utils/moabomLanguageSync';
import { buildAuthLanguageSelectOptions, normalizeRegisterUiLanguage } from '../../utils/moabomAuthLanguage';
import { isMoabomUiLanguage } from '../../utils/moabomLocaleCatalog';
import { loadMoabomSystemState } from '../../utils/moabomSystemStore';
import { Button } from '../basic/Button';
import { Div } from '../basic/Div';
import { Form } from '../basic/Form';
import { Icon } from '../basic/Icon';
import { Input } from '../basic/Input';
import { P } from '../basic/P';
import { Select } from '../basic/Select';
import { Span } from '../basic/Span';
import { Svg } from '../basic/Svg';
import { SwitchCheckbox } from '../basic/SwitchCheckbox';
import { fetchEnabledSocialProviders, startSocialAuth } from '../../utils/socialAuth';
import { moaFieldControlClass } from '../../theme/moabomFieldSurface';
import { APP_SHELL_PANEL_BODY_CLASS } from '../../apps/appShellTypography';

export type AuthWindowMode = 'login' | 'register' | 'forgot-password' | 'reset-password';

interface AuthUser {
  name?: string;
  nickname?: string;
  email?: string;
  level?: number;
  point?: number;
}

interface ApiErrorPayload {
  message?: string;
  errors?: Record<string, string[] | string>;
}

export interface AuthWindowContentProps {
  mode: AuthWindowMode;
  onSwitchMode: (mode: AuthWindowMode) => void;
  onAuthenticated: (user?: AuthUser | null) => void;
  /** 모바일 전체 창(compact)에서 세로 채우기·중앙 정렬. PC에서는 거짓이면 콘텐츠 자연 높이 */
  stretchVertically?: boolean;
}

const inputClassName = moaFieldControlClass('medium');
const labelClassName = 'block text-xs font-bold text-secondary mb-2';
const authSocialOrder = ['google', 'naver', 'kakao'] as const;
type AuthSocialProvider = typeof authSocialOrder[number];

const AUTH_SOCIAL_STYLES: Record<AuthSocialProvider, {
  className: string;
  style: React.CSSProperties;
  iconWrapClassName: string;
}> = {
  google: {
    className: 'social-login-btn social-google social_link moa-btn moa-btn-medium w-full cursor-pointer justify-center gap-2 px-3',
    style: {
      borderRadius: '0.9rem',
      background: 'rgba(255,255,255,0.8)',
      border: 'solid 1px #eee',
      boxShadow: '0 8px 13px -3px rgba(0,0,0,0.07), 0 3px 5px -3px rgba(0,0,0,0.07)',
    },
    iconWrapClassName: 'w-5 h-5 flex items-center justify-center shrink-0',
  },
  naver: {
    className: 'social-login-btn social-naver social_link moa-btn moa-btn-medium w-full cursor-pointer justify-center gap-2 px-3',
    style: {
      borderRadius: '0.9rem',
      background: 'rgba(3,169,77,0.8)',
      border: 'solid 1px #03a94d',
      boxShadow: '0 8px 13px -3px rgba(0,0,0,0.07), 0 3px 5px -3px rgba(0,0,0,0.07)',
    },
    iconWrapClassName: 'w-4 h-4 flex items-center justify-center shrink-0',
  },
  kakao: {
    className: 'social-login-btn social-kakao social_link moa-btn moa-btn-medium w-full cursor-pointer justify-center gap-2 px-3',
    style: {
      borderRadius: '0.9rem',
      background: 'rgba(254,229,0,0.8)',
      border: 'solid 1px #fee500',
      boxShadow: '0 8px 13px -3px rgba(0,0,0,0.07), 0 3px 5px -3px rgba(0,0,0,0.07)',
    },
    iconWrapClassName: 'w-[18px] h-[18px] flex items-center justify-center shrink-0',
  },
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function getFieldError(errors: ApiErrorPayload['errors'], field: string): string {
  const value = errors?.[field];
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function renderAuthSocialIcon(provider: AuthSocialProvider): React.ReactNode {
  if (provider === 'google') {
    return (
      <Svg viewBox="0 0 48 48" width={20} height={20} style={{ display: 'block' }}>
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        <path fill="none" d="M0 0h48v48H0z" />
      </Svg>
    );
  }

  if (provider === 'naver') {
    return (
      <Svg viewBox="0 0 48 48" width={15} height={15} style={{ display: 'block' }}>
        <path fill="#FFFFFF" d="M32.5,25.7L14.7,0H0v48h15.5V22.3L33.2,48H48V0H32.5V25.7z" />
      </Svg>
    );
  }

  return (
    <Svg viewBox="0 0 48 48" width={18} height={18} style={{ display: 'block' }}>
      <path fill="#1A1807" d="M24,1.5C10.7,1.5,0,9.8,0,20.1c0,6.4,4.2,12,10.5,15.4l-2.7,9.8c-0.2,0.9,0.7,1.6,1.5,1.1L21,38.6c1,0.1,2,0.2,3,0.2c13.3,0,24-8.3,24-18.6C48,9.8,37.3,1.5,24,1.5" />
    </Svg>
  );
}

async function readError(response: Response, fallback: string): Promise<Error> {
  try {
    const payload = await response.json() as ApiErrorPayload;
    const error = new Error(payload.message ?? fallback) as Error & { errors?: ApiErrorPayload['errors'] };
    error.errors = payload.errors;
    return error;
  } catch {
    return new Error(fallback);
  }
}

export const AuthWindowContent: React.FC<AuthWindowContentProps> = ({
  mode,
  onSwitchMode,
  onAuthenticated,
  stretchVertically = false,
}) => {
  const { t } = useMoabomShellT();

  const socialShortLabels = useMemo(
    () => ({
      google: t('moa_auth.social_google_short'),
      naver: t('moa_auth.social_naver_short'),
      kakao: t('moa_auth.social_kakao_short'),
    }),
    [t],
  );

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [forgotForm, setForgotForm] = useState({ email: '' });
  const [resetForm, setResetForm] = useState({
    token: '',
    email: '',
    password: '',
    password_confirmation: '',
  });
  const [registerForm, setRegisterForm] = useState(() => {
    const pref = loadMoabomSystemState().preferences.language;
    const uiLanguage = isMoabomUiLanguage(pref) ? pref : 'ko';
    return {
      name: '',
      nickname: '',
      email: '',
      password: '',
      password_confirmation: '',
      language: uiLanguage,
      agree_terms: false,
      agree_privacy: false,
    };
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | string>>({});
  const [enabledProviders, setEnabledProviders] = useState<string[]>([]);

  useEffect(() => {
    if (mode !== 'reset-password') return;

    const params = new URLSearchParams(window.location.search);
    setResetForm(prev => ({
      ...prev,
      token: params.get('token') ?? prev.token,
      email: params.get('email') ?? prev.email,
    }));
  }, [mode]);

  useEffect(() => {
    let mounted = true;

    if (mode !== 'login' && mode !== 'register') return;

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
  }, [mode]);

  const resetFeedback = () => {
    setMessage('');
    setFieldErrors({});
  };

  const registerLanguageOptions = useMemo(() => buildAuthLanguageSelectOptions(t), [t]);

  const showToast = (type: 'success' | 'error', nextMessage: string) => {
    const G7Core = (window as any).G7Core;
    G7Core?.toast?.[type]?.(nextMessage, 3000);
  };

  const getModeTitle = (): string => {
    if (mode === 'register') return t('moa_auth.title_register');
    if (mode === 'forgot-password') return t('moa_auth.title_forgot_password');
    if (mode === 'reset-password') return t('moa_auth.title_reset_password');
    return t('moa_auth.title_login');
  };

  const getModeDescription = (): string => {
    if (mode === 'register') return t('moa_auth.desc_register');
    if (mode === 'forgot-password') return t('moa_auth.desc_forgot_password');
    if (mode === 'reset-password') return t('moa_auth.desc_reset_password');
    return t('moa_auth.desc_login');
  };

  const getModeIcon = (): string => {
    if (mode === 'register') return 'user-plus';
    if (mode === 'forgot-password') return 'envelope';
    if (mode === 'reset-password') return 'key';
    return 'lock';
  };

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();
    setIsSubmitting(true);

    try {
      const G7Core = (window as any).G7Core;
      if (!G7Core?.AuthManager) {
        throw new Error(t('moa_auth.login_unavailable'));
      }

      const user = await G7Core.AuthManager.getInstance().login('user', {
        email: loginForm.email,
        password: loginForm.password,
      });

      showToast('success', t('moa_auth.login_success'));
      onAuthenticated(user);
    } catch (error) {
      const nextMessage = getErrorMessage(error, t('moa_auth.login_failed'));
      setMessage(nextMessage);
      setFieldErrors((error as { response?: { data?: ApiErrorPayload } })?.response?.data?.errors ?? {});
      showToast('error', nextMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();
    setIsSubmitting(true);

    try {
      const uiLanguage = normalizeRegisterUiLanguage(registerForm.language);
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...registerForm,
          language: coreSyncLanguageFromMoabomPref(uiLanguage),
        }),
      });

      if (!response.ok) {
        throw await readError(response, t('moa_auth.register_failed'));
      }

      showToast('success', t('moa_auth.register_success'));

      const G7Core = (window as any).G7Core;
      if (G7Core?.AuthManager) {
        const user = await G7Core.AuthManager.getInstance().login('user', {
          email: registerForm.email,
          password: registerForm.password,
        });
        onAuthenticated(user);
        return;
      }

      onSwitchMode('login');
    } catch (error) {
      const nextMessage = getErrorMessage(error, t('moa_auth.register_failed'));
      setMessage(nextMessage);
      setFieldErrors((error as { errors?: ApiErrorPayload['errors'] })?.errors ?? {});
      showToast('error', nextMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitForgotPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: forgotForm.email,
        }),
      });

      if (!response.ok) {
        throw await readError(response, t('moa_auth.err_forgot_send_failed'));
      }

      const nextMessage = t('moa_auth.msg_forgot_sent');
      setMessage(nextMessage);
      showToast('success', nextMessage);
    } catch (error) {
      const nextMessage = getErrorMessage(error, t('moa_auth.err_forgot_failed_generic'));
      setMessage(nextMessage);
      setFieldErrors((error as { errors?: ApiErrorPayload['errors'] })?.errors ?? {});
      showToast('error', nextMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();
    setIsSubmitting(true);

    try {
      const validateResponse = await fetch('/api/auth/validate-reset-token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: resetForm.token,
          email: resetForm.email,
        }),
      });

      if (!validateResponse.ok) {
        throw await readError(validateResponse, t('moa_auth.err_reset_token_invalid'));
      }

      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resetForm),
      });

      if (!response.ok) {
        throw await readError(response, t('moa_auth.err_reset_failed'));
      }

      showToast('success', t('moa_auth.msg_reset_success'));
      onSwitchMode('login');
    } catch (error) {
      const nextMessage = getErrorMessage(error, t('moa_auth.err_reset_failed'));
      setMessage(nextMessage);
      setFieldErrors((error as { errors?: ApiErrorPayload['errors'] })?.errors ?? {});
      showToast('error', nextMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderError = (field: string) => {
    const error = getFieldError(fieldErrors, field);
    if (!error) return null;

    return <P className="mt-1 text-xs text-error">{error}</P>;
  };

  const visibleSocialProviders = authSocialOrder.filter(provider => enabledProviders.includes(provider));
  const shouldCenterContent = stretchVertically && mode !== 'register';

  return (
    <Div
      className={`moa-auth-window text-primary ${stretchVertically ? `min-h-full ${shouldCenterContent ? 'justify-center' : 'justify-start'}` : ''}`}
    >
      <Div className={APP_SHELL_PANEL_BODY_CLASS}>
          <Div className="mb-6 text-center">
            <Div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white"
              style={{ background: 'var(--moa-point-color)' }}
            >
              <Icon name={getModeIcon()} className="text-2xl" />
            </Div>
            <P className="text-2xl font-bold text-primary">
              {getModeTitle()}
            </P>
            <P className="mt-2 text-sm text-secondary">
              {getModeDescription()}
            </P>
          </Div>

          {message && (
            <Div className="mb-4 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50/80 dark:bg-red-900/20 px-4 py-3">
              <P className="text-sm text-error">{message}</P>
            </Div>
          )}

          {mode === 'login' ? (
            <Form className="space-y-4" onSubmit={submitLogin}>
              <Div>
                <Span className={labelClassName}>{t('moa_auth.email')}</Span>
                <Input
                  type="email"
                  name="email"
                  autoComplete="username"
                  className={inputClassName}
                  placeholder="email@example.com"
                  value={loginForm.email}
                  onChange={(event) => setLoginForm(prev => ({ ...prev, email: event.target.value }))}
                  required
                  disabled={isSubmitting}
                />
                {renderError('email')}
              </Div>
              <Div>
                <Span className={labelClassName}>{t('moa_auth.password')}</Span>
                <Input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  className={inputClassName}
                  value={loginForm.password}
                  onChange={(event) => setLoginForm(prev => ({ ...prev, password: event.target.value }))}
                  required
                  disabled={isSubmitting}
                />
                {renderError('password')}
              </Div>
              <Button
                type="submit"
                variant="primary"
                size="medium"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? t('moa_auth.login_submitting') : t('moa_auth.login_button')}
              </Button>
              <Div className="flex justify-end text-xs">
                <Button
                  type="button"
                  className="text-muted hover:text-[color:var(--moa-point-color)] hover:underline"
                  onClick={() => onSwitchMode('forgot-password')}
                  disabled={isSubmitting}
                >
                  {t('moa_auth.forgot_password_link')}
                </Button>
              </Div>
            </Form>
          ) : mode === 'register' ? (
            <Form className="space-y-4" onSubmit={submitRegister}>
              <Div>
                <Span className={labelClassName}>{t('moa_auth.email')}</Span>
                <Input
                  type="email"
                  name="email"
                  autoComplete="username"
                  className={inputClassName}
                  placeholder="email@example.com"
                  value={registerForm.email}
                  onChange={(event) => setRegisterForm(prev => ({ ...prev, email: event.target.value }))}
                  required
                  disabled={isSubmitting}
                />
                {renderError('email')}
              </Div>
              <Div>
                <Span className={labelClassName}>{t('moa_auth.password')}</Span>
                <Input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  className={inputClassName}
                  value={registerForm.password}
                  onChange={(event) => setRegisterForm(prev => ({ ...prev, password: event.target.value }))}
                  required
                  minLength={8}
                  disabled={isSubmitting}
                />
                {renderError('password')}
              </Div>
              <Div>
                <Span className={labelClassName}>{t('moa_auth.password_confirm')}</Span>
                <Input
                  type="password"
                  name="password_confirmation"
                  autoComplete="new-password"
                  className={inputClassName}
                  value={registerForm.password_confirmation}
                  onChange={(event) => setRegisterForm(prev => ({ ...prev, password_confirmation: event.target.value }))}
                  required
                  minLength={8}
                  disabled={isSubmitting}
                />
              </Div>
              <Div>
                <Span className={labelClassName}>{t('moa_auth.name')}</Span>
                <Input
                  className={inputClassName}
                  placeholder={t('moa_auth.name_placeholder')}
                  value={registerForm.name}
                  onChange={(event) => setRegisterForm(prev => ({ ...prev, name: event.target.value }))}
                  required
                  disabled={isSubmitting}
                />
                {renderError('name')}
              </Div>
              <Div>
                <Span className={labelClassName}>{t('moa_auth.nickname')}</Span>
                <Input
                  className={inputClassName}
                  placeholder={t('moa_auth.nickname_placeholder')}
                  value={registerForm.nickname}
                  onChange={(event) => setRegisterForm(prev => ({ ...prev, nickname: event.target.value }))}
                  disabled={isSubmitting}
                />
                {renderError('nickname')}
              </Div>
              <Div>
                <Span className={labelClassName}>{t('moa_auth.language')}</Span>
                <Select
                  className={inputClassName}
                  value={registerForm.language}
                  options={registerLanguageOptions}
                  onChange={(event) => setRegisterForm(prev => ({
                    ...prev,
                    language: normalizeRegisterUiLanguage(event.target.value),
                  }))}
                  disabled={isSubmitting}
                />
                {renderError('language')}
              </Div>
              <Div className="space-y-2 rounded-2xl p-3 text-xs glass-sm">
                <SwitchCheckbox
                  checked={registerForm.agree_terms}
                  onChange={(event) => setRegisterForm(prev => ({ ...prev, agree_terms: event.target.checked }))}
                  disabled={isSubmitting}
                  label={t('moa_auth.agree_terms')}
                />
                <SwitchCheckbox
                  checked={registerForm.agree_privacy}
                  onChange={(event) => setRegisterForm(prev => ({ ...prev, agree_privacy: event.target.checked }))}
                  disabled={isSubmitting}
                  label={t('moa_auth.agree_privacy')}
                />
                {renderError('agree_terms')}
                {renderError('agree_privacy')}
              </Div>
              <Button
                type="submit"
                variant="primary"
                size="medium"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? t('moa_auth.register_submitting') : t('moa_auth.register_button')}
              </Button>
            </Form>
          ) : mode === 'forgot-password' ? (
            <Form className="space-y-4" onSubmit={submitForgotPassword}>
              <Div>
                <Span className={labelClassName}>{t('moa_auth.email')}</Span>
                <Input
                  type="email"
                  name="email"
                  autoComplete="username"
                  className={inputClassName}
                  placeholder="email@example.com"
                  value={forgotForm.email}
                  onChange={(event) => setForgotForm(prev => ({ ...prev, email: event.target.value }))}
                  required
                  disabled={isSubmitting}
                />
                {renderError('email')}
              </Div>
              <Button
                type="submit"
                variant="primary"
                size="medium"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? t('moa_auth.forgot_submitting') : t('moa_auth.forgot_submit_button')}
              </Button>
            </Form>
          ) : (
            <Form className="space-y-4" onSubmit={submitResetPassword}>
              <Div>
                <Span className={labelClassName}>{t('moa_auth.email')}</Span>
                <Input
                  type="email"
                  name="email"
                  autoComplete="username"
                  className={inputClassName}
                  placeholder="email@example.com"
                  value={resetForm.email}
                  onChange={(event) => setResetForm(prev => ({ ...prev, email: event.target.value }))}
                  required
                  disabled={isSubmitting}
                />
                {renderError('email')}
              </Div>
              <Div>
                <Span className={labelClassName}>{t('moa_auth.reset_token_label')}</Span>
                <Input
                  name="token"
                  className={inputClassName}
                  value={resetForm.token}
                  onChange={(event) => setResetForm(prev => ({ ...prev, token: event.target.value }))}
                  required
                  disabled={isSubmitting}
                />
                {renderError('token')}
              </Div>
              <Div>
                <Span className={labelClassName}>{t('moa_auth.new_password_label')}</Span>
                <Input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  className={inputClassName}
                  value={resetForm.password}
                  onChange={(event) => setResetForm(prev => ({ ...prev, password: event.target.value }))}
                  required
                  minLength={8}
                  disabled={isSubmitting}
                />
                {renderError('password')}
              </Div>
              <Div>
                <Span className={labelClassName}>{t('moa_auth.new_password_confirm_label')}</Span>
                <Input
                  type="password"
                  name="password_confirmation"
                  autoComplete="new-password"
                  className={inputClassName}
                  value={resetForm.password_confirmation}
                  onChange={(event) => setResetForm(prev => ({ ...prev, password_confirmation: event.target.value }))}
                  required
                  minLength={8}
                  disabled={isSubmitting}
                />
              </Div>
              <Button
                type="submit"
                variant="primary"
                size="medium"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? t('moa_auth.reset_submitting') : t('moa_auth.reset_submit_button')}
              </Button>
            </Form>
          )}

          {(mode === 'login' || mode === 'register') && visibleSocialProviders.length > 0 && (
            <>
              <Div className="my-5 flex items-center gap-3">
                <Div className="h-px flex-1 bg-slate-400/40 dark:bg-slate-500/40" />
                <Span className="text-xs font-bold text-muted">{t('moa_auth.sns_divider')}</Span>
                <Div className="h-px flex-1 bg-slate-400/40 dark:bg-slate-500/40" />
              </Div>

              <Div className="grid grid-cols-3 gap-2">
                {visibleSocialProviders.map(provider => {
                  const styles = AUTH_SOCIAL_STYLES[provider];
                  const label = socialShortLabels[provider];

                  return (
                    <Button
                      key={provider}
                      type="button"
                      aria-label={label}
                      onClick={() => startSocialAuth(provider)}
                      disabled={isSubmitting}
                      className={styles.className}
                      style={styles.style}
                    >
                      <Div className={styles.iconWrapClassName}>
                        {renderAuthSocialIcon(provider)}
                      </Div>
                      <Span className={`hidden flex-1 text-center @sm:inline ${provider === 'google' ? 'text-[#1f1f1f]' : provider === 'naver' ? 'text-white' : 'text-[#1a1807]'}`}>
                        {label}
                      </Span>
                    </Button>
                  );
                })}
              </Div>
            </>
          )}

          <Div className="mt-5 flex items-center justify-center gap-2 text-sm text-muted">
            {mode === 'login' || mode === 'register' ? (
              <>
                <Span>
                  {mode === 'login' ? t('moa_auth.no_account') : t('moa_auth.have_account')}
                </Span>
                <Button
                  type="button"
                  className="text-[color:var(--moa-point-color)] hover:underline"
                  onClick={() => onSwitchMode(mode === 'login' ? 'register' : 'login')}
                >
                  {mode === 'login' ? t('moa_auth.title_register') : t('moa_auth.title_login')}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                className="text-[color:var(--moa-point-color)] hover:underline"
                onClick={() => onSwitchMode('login')}
                disabled={isSubmitting}
              >
                {t('moa_auth.back_to_login')}
              </Button>
            )}
          </Div>
        </Div>
    </Div>
  );
};
