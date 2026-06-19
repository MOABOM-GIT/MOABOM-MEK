import React from 'react';
import type { MoabomTranslateFn } from '../../../i18n/moabomT';
import { Button } from '../../basic/Button';
import AppLoadingSpinner from '../AppLoadingSpinner';
import { Div } from '../../basic/Div';
import { Input } from '../../basic/Input';
import { Span } from '../../basic/Span';
import { APP_STACK_CLASS, APP_STACK_GRID_CLASS } from '../../../apps/appShellTypography';
import { ACTION_BUTTON_VARIANT, GROUP_PANEL, INPUT_SURFACE, MY_PAGE_BLOCK_TITLE_CLASS } from './myPageStyles';
import { isSyntheticEmail } from './myPageUtils';

export interface Moa_MyPageAccountPanelProps {
  t: MoabomTranslateFn;
  profileName: string;
  setProfileName: (value: string) => void;
  profileEmail: string;
  setProfileEmail: (value: string) => void;
  profileMobile: string;
  setProfileMobile: (value: string) => void;
  profileBusy: boolean;
  profileLoading: boolean;
  profileBanner: { text: string } | null;
  profileErr: (field: string) => string;
  profileSaveSubmitting: boolean;
  socialProviderLabel: string | null;
  securityPanel: 'none' | 'password' | 'withdraw';
  setSecurityPanel: (panel: 'none' | 'password' | 'withdraw') => void;
  securityCurrentPassword: string;
  setSecurityCurrentPassword: (value: string) => void;
  securityVerified: boolean;
  setSecurityVerified: (value: boolean) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  newPasswordConfirmation: string;
  setNewPasswordConfirmation: (value: string) => void;
  securitySubmitting: boolean;
  securityMessage: { type: 'success' | 'error'; text: string } | null;
  setSecurityMessage: (message: { type: 'success' | 'error'; text: string } | null) => void;
  onSaveProfile: () => void;
  onOpenPasswordPanel: () => void;
  onOpenWithdrawPanel: () => void;
  onVerifySecurityPassword: () => void;
  onChangePassword: () => void;
  onWithdraw: () => void;
}

export const Moa_MyPageAccountPanel: React.FC<Moa_MyPageAccountPanelProps> = ({
  t,
  profileName,
  setProfileName,
  profileEmail,
  setProfileEmail,
  profileMobile,
  setProfileMobile,
  profileBusy,
  profileLoading,
  profileBanner,
  profileErr,
  profileSaveSubmitting,
  socialProviderLabel,
  securityPanel,
  setSecurityPanel,
  securityCurrentPassword,
  setSecurityCurrentPassword,
  securityVerified,
  setSecurityVerified,
  newPassword,
  setNewPassword,
  newPasswordConfirmation,
  setNewPasswordConfirmation,
  securitySubmitting,
  securityMessage,
  setSecurityMessage,
  onSaveProfile,
  onOpenPasswordPanel,
  onOpenWithdrawPanel,
  onVerifySecurityPassword,
  onChangePassword,
  onWithdraw,
}) => (
  <Div className={`moa-mypage-account ${APP_STACK_CLASS}`}>
    <Div className={`${GROUP_PANEL} p-5 ${APP_STACK_CLASS}`}>
      <Div>
        <Div className={MY_PAGE_BLOCK_TITLE_CLASS}>{t('moa_mypage.account.section_basic_title')}</Div>
        <Div className="text-sm text-secondary mt-1">{t('moa_mypage.account.section_basic_desc')}</Div>
      </Div>

      {profileBanner && (
        <Div className="rounded-xl px-4 py-3 text-sm bg-red-50 text-red-700 border border-red-200">
          {profileBanner.text}
        </Div>
      )}

      {profileLoading ? (
        <AppLoadingSpinner label={t('moa_mypage.account.loading')} />
      ) : (
        <>
          <Div>
            <Span className={`block ${MY_PAGE_BLOCK_TITLE_CLASS}`}>{t('moa_mypage.account.name')}</Span>
            <Input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className={INPUT_SURFACE}
              maxLength={255}
              disabled={profileBusy}
            />
            {profileErr('name') ? (
              <Span className="mt-1 block text-xs text-red-500">{profileErr('name')}</Span>
            ) : null}
          </Div>

          <Div>
            <Span className={`block ${MY_PAGE_BLOCK_TITLE_CLASS}`}>{t('moa_mypage.account.email')}</Span>
            <Input
              type="email"
              value={profileEmail}
              onChange={(e) => setProfileEmail(e.target.value)}
              className={INPUT_SURFACE}
              disabled={profileBusy}
            />
            {isSyntheticEmail(profileEmail) ? (
              <Span className="mt-1 block text-xs text-amber-700">
                {t('moa_mypage.account.email_synthetic_hint')}
              </Span>
            ) : null}
            {profileErr('email') ? (
              <Span className="mt-1 block text-xs text-red-500">{profileErr('email')}</Span>
            ) : null}
          </Div>

          <Div>
            <Span className={`block ${MY_PAGE_BLOCK_TITLE_CLASS}`}>{t('moa_mypage.account.mobile')}</Span>
            <Input
              type="tel"
              value={profileMobile}
              onChange={(e) => setProfileMobile(e.target.value)}
              className={INPUT_SURFACE}
              placeholder={t('moa_mypage.account.mobile_placeholder')}
              maxLength={20}
              disabled={profileBusy}
            />
            {profileErr('mobile') ? (
              <Span className="mt-1 block text-xs text-red-500">{profileErr('mobile')}</Span>
            ) : null}
          </Div>

          <Div className="flex justify-end">
            <Button
              variant={ACTION_BUTTON_VARIANT}
              size="medium"
              type="button"
              disabled={profileBusy || profileLoading}
              onClick={() => void onSaveProfile()}
            >
              {profileSaveSubmitting ? t('moa_mypage.profile.saving') : t('moa_mypage.account.save_account')}
            </Button>
          </Div>
        </>
      )}
    </Div>

    <Div className={`${APP_STACK_GRID_CLASS} grid grid-cols-1`}>
      <Div className={`${GROUP_PANEL} p-5 ${APP_STACK_CLASS}`}>
        <Div className={MY_PAGE_BLOCK_TITLE_CLASS}>{t('moa_mypage.account.section_security_title')}</Div>
        <Div className="text-sm text-secondary">{t('moa_mypage.account.section_security_desc')}</Div>
        <Div className="flex gap-2">
          <Button
            variant="dark-outline"
            size="medium"
            type="button"
            onClick={onOpenPasswordPanel}
          >
            {t('moa_mypage.account.change_password')}
          </Button>
          <Button
            variant="danger-outline"
            size="medium"
            type="button"
            onClick={onOpenWithdrawPanel}
          >
            {t('moa_mypage.account.withdraw')}
          </Button>
        </Div>

        {securityPanel !== 'none' ? (
          <Div className={`${GROUP_PANEL} p-4 ${APP_STACK_CLASS}`}>
            <Div className={MY_PAGE_BLOCK_TITLE_CLASS}>
              {securityPanel === 'password' ? t('moa_mypage.account.panel_password_title') : t('moa_mypage.account.panel_withdraw_title')}
            </Div>
            <Div className="text-xs text-muted">
              {securityPanel === 'password'
                ? socialProviderLabel
                  ? t('moa_mypage.account.panel_password_desc_sns', { provider: socialProviderLabel })
                  : t('moa_mypage.account.panel_password_desc_local')
                : socialProviderLabel
                  ? t('moa_mypage.account.panel_withdraw_desc_sns', { provider: socialProviderLabel })
                  : t('moa_mypage.account.panel_withdraw_desc_local')}
            </Div>

            <Div className={`${APP_STACK_GRID_CLASS} grid grid-cols-1`}>
              {securityPanel === 'password' && socialProviderLabel ? (
                <Div className={APP_STACK_CLASS}>
                  <Div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-xs text-muted">
                    {t('moa_mypage.account.sns_no_password_note', { provider: socialProviderLabel })}
                  </Div>
                  <Div className="flex justify-end">
                    <Button
                      variant="dark-outline"
                      size="medium"
                      type="button"
                      onClick={() => setSecurityPanel('none')}
                    >
                      {t('moa_mypage.common.close')}
                    </Button>
                  </Div>
                </Div>
              ) : null}

              {!(socialProviderLabel && (securityPanel === 'withdraw' || securityPanel === 'password')) ? (
                <Div>
                  <Span className={`block ${MY_PAGE_BLOCK_TITLE_CLASS}`}>{t('moa_mypage.account.current_password')}</Span>
                  <Input
                    type="password"
                    value={securityCurrentPassword}
                    onChange={(e) => {
                      setSecurityCurrentPassword(e.target.value);
                      setSecurityVerified(false);
                      setSecurityMessage(null);
                    }}
                    className={INPUT_SURFACE}
                    placeholder={t('moa_mypage.account.current_password_placeholder')}
                    autoComplete="current-password"
                    disabled={securitySubmitting}
                  />
                </Div>
              ) : null}

              {!securityVerified && !(securityPanel === 'password' && socialProviderLabel) ? (
                <Div className="flex justify-end gap-2">
                  <Button
                    variant="dark-outline"
                    size="medium"
                    type="button"
                    disabled={securitySubmitting}
                    onClick={() => setSecurityPanel('none')}
                  >
                    {t('moa_mypage.common.cancel')}
                  </Button>
                  <Button
                    variant={ACTION_BUTTON_VARIANT}
                    size="medium"
                    type="button"
                    disabled={securitySubmitting || !securityCurrentPassword}
                    onClick={() => void onVerifySecurityPassword()}
                  >
                    {securitySubmitting ? t('moa_mypage.account.verifying') : t('moa_mypage.account.verify_password')}
                  </Button>
                </Div>
              ) : null}

              {securityPanel === 'password' && securityVerified ? (
                <>
                  <Div>
                    <Span className={`block ${MY_PAGE_BLOCK_TITLE_CLASS}`}>{t('moa_mypage.account.new_password')}</Span>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={INPUT_SURFACE}
                      placeholder={t('moa_mypage.account.new_password_placeholder')}
                      autoComplete="new-password"
                      disabled={securitySubmitting}
                    />
                  </Div>
                  <Div>
                    <Span className={`block ${MY_PAGE_BLOCK_TITLE_CLASS}`}>{t('moa_mypage.account.new_password_confirm')}</Span>
                    <Input
                      type="password"
                      value={newPasswordConfirmation}
                      onChange={(e) => setNewPasswordConfirmation(e.target.value)}
                      className={INPUT_SURFACE}
                      placeholder={t('moa_mypage.account.new_password_confirm_placeholder')}
                      autoComplete="new-password"
                      disabled={securitySubmitting}
                    />
                  </Div>
                  <Div className="flex justify-end gap-2">
                    <Button
                      variant="dark-outline"
                      size="medium"
                      type="button"
                      disabled={securitySubmitting}
                      onClick={() => setSecurityPanel('none')}
                    >
                      {t('moa_mypage.common.cancel')}
                    </Button>
                    <Button
                      variant={ACTION_BUTTON_VARIANT}
                      size="medium"
                      type="button"
                      disabled={securitySubmitting || !newPassword || !newPasswordConfirmation}
                      onClick={() => void onChangePassword()}
                    >
                      {securitySubmitting ? t('moa_mypage.account.changing_password') : t('moa_mypage.account.change_password')}
                    </Button>
                  </Div>
                </>
              ) : null}

              {securityPanel === 'withdraw' && securityVerified ? (
                <Div className={APP_STACK_CLASS}>
                  <Div className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-600">
                    {socialProviderLabel
                      ? t('moa_mypage.account.withdraw_warning_sns', { provider: socialProviderLabel })
                      : t('moa_mypage.account.withdraw_warning_local')}
                  </Div>
                  <Div className="flex justify-end gap-2">
                    <Button
                      variant="dark-outline"
                      size="medium"
                      type="button"
                      disabled={securitySubmitting}
                      onClick={() => setSecurityPanel('none')}
                    >
                      {t('moa_mypage.common.cancel')}
                    </Button>
                    <Button
                      variant="danger-outline"
                      size="medium"
                      type="button"
                      disabled={securitySubmitting}
                      onClick={() => void onWithdraw()}
                    >
                      {securitySubmitting ? t('moa_mypage.account.withdraw_processing') : t('moa_mypage.account.withdraw_confirm')}
                    </Button>
                  </Div>
                </Div>
              ) : null}

              {securityMessage ? (
                <Div className={`text-xs ${securityMessage.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {securityMessage.text}
                </Div>
              ) : null}
            </Div>
          </Div>
        ) : null}
      </Div>
    </Div>
  </Div>
);
