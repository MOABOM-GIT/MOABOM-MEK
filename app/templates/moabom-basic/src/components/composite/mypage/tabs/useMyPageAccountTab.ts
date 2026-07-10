import { useState } from 'react';
import { isAiGenerationBusy } from 'moabom-ai-generation-activity';
import type { MoabomTranslateFn } from '../../../../i18n/moabomT';
import { pushInfoToast } from '../../../../runtime/moaShellToasts';
import {
  changePasswordApi,
  verifyPasswordApi,
  withdrawUserApi,
} from '../myPageApi';
import { flattenFieldErrors, getSocialProviderLabel, showCoreToast } from '../myPageUtils';

interface UseMyPageAccountTabOptions {
  t: MoabomTranslateFn;
  socialProviderLabel: string | null;
}

export function useMyPageAccountTab({
  t,
  socialProviderLabel,
}: UseMyPageAccountTabOptions) {
  const [securityPanel, setSecurityPanel] = useState<'none' | 'password' | 'withdraw'>('none');
  const [securityCurrentPassword, setSecurityCurrentPassword] = useState('');
  const [securityVerified, setSecurityVerified] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [securitySubmitting, setSecuritySubmitting] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const openSecurityPanel = (panel: 'password' | 'withdraw') => {
    setSecurityPanel(panel);
    setSecurityCurrentPassword('');
    setSecurityVerified(false);
    setNewPassword('');
    setNewPasswordConfirmation('');
    setSecurityMessage(null);
  };

  const handleOpenPasswordPanel = () => {
    openSecurityPanel('password');
  };

  const handleOpenWithdrawPanel = () => {
    openSecurityPanel('withdraw');
    if (socialProviderLabel) {
      setSecurityVerified(true);
      setSecurityMessage(null);
    }
  };

  const handleVerifySecurityPassword = async () => {
    setSecuritySubmitting(true);
    setSecurityMessage(null);

    try {
      const result = await verifyPasswordApi(securityCurrentPassword);
      if (!result.ok) {
        setSecurityVerified(false);
        setSecurityMessage({ type: 'error', text: result.message ?? t('moa_mypage.msg.password_verify_failed') });
        return;
      }

      setSecurityVerified(true);
      setSecurityMessage({ type: 'success', text: result.message ?? t('moa_mypage.msg.password_verified') });
    } finally {
      setSecuritySubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    setSecuritySubmitting(true);
    setSecurityMessage(null);

    try {
      const result = await changePasswordApi(securityCurrentPassword, newPassword, newPasswordConfirmation);
      if (!result.ok) {
        const errors = flattenFieldErrors(result.errors);
        setSecurityMessage({
          type: 'error',
          text: Object.values(errors)[0] ?? result.message ?? t('moa_mypage.msg.password_change_failed'),
        });
        return;
      }

      setSecurityMessage({ type: 'success', text: result.message ?? t('moa_mypage.msg.password_changed') });
      setSecurityCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirmation('');
      setSecurityVerified(false);
    } finally {
      setSecuritySubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (isAiGenerationBusy()) {
      pushInfoToast(t('moa_apps_ai.toast_generation_in_progress_blocked'));
      return;
    }

    setSecuritySubmitting(true);
    setSecurityMessage(null);

    try {
      const result = await withdrawUserApi();
      if (!result.ok) {
        setSecurityMessage({ type: 'error', text: result.message ?? t('moa_mypage.msg.withdraw_failed') });
        return;
      }

      showCoreToast('success', result.message ?? t('moa_mypage.msg.withdraw_success'), 3000);
      const G7Core = (window as any).G7Core;
      await G7Core?.AuthManager?.getInstance?.()?.logout?.();
      window.location.href = '/';
    } finally {
      setSecuritySubmitting(false);
    }
  };

  return {
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
    handleOpenPasswordPanel,
    handleOpenWithdrawPanel,
    handleVerifySecurityPassword,
    handleChangePassword,
    handleWithdraw,
  };
}

export { getSocialProviderLabel };
