import { useEffect, useState } from 'react';
import type { MoabomTranslateFn } from '../../../../i18n/moabomT';
import type { MoabomSystemLanguage } from '../../../../types/moabomSystem';
import { checkAttendanceApi, fetchUserCreditsApi } from '../myPageApi';
import type { CreditOverview, MyPageTab, MyPageUser } from '../myPageTypes';
import { showCoreToast } from '../myPageUtils';

interface UseMyPageCreditTabOptions {
  activeTab: MyPageTab;
  currentUser: MyPageUser | null;
  shellLanguage: MoabomSystemLanguage;
  t: MoabomTranslateFn;
}

export function useMyPageCreditTab({
  activeTab,
  currentUser,
  shellLanguage,
  t,
}: UseMyPageCreditTabOptions) {
  const [creditOverview, setCreditOverview] = useState<CreditOverview | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditError, setCreditError] = useState('');
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceMessage, setAttendanceMessage] = useState('');

  useEffect(() => {
    if (activeTab !== 'credit' || !currentUser) return;

    let cancelled = false;
    setCreditLoading(true);
    setCreditError('');

    void (async () => {
      try {
        const result = await fetchUserCreditsApi();
        if (cancelled) return;

        if (!result.ok || !result.data) {
          setCreditError(result.message ?? t('moa_mypage.msg.credit_load_failed'));
          return;
        }

        setCreditOverview(result.data);
      } catch {
        if (!cancelled) {
          setCreditError(t('moa_mypage.msg.credit_load_failed'));
        }
      } finally {
        if (!cancelled) {
          setCreditLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, currentUser, shellLanguage, t]);

  const handleAttendanceCheck = async () => {
    setAttendanceLoading(true);
    setAttendanceMessage('');
    setCreditError('');

    try {
      const result = await checkAttendanceApi();
      if (!result.ok) {
        const message = result.errors?.message ?? result.message ?? t('moa_mypage.msg.attendance_failed');
        setAttendanceMessage(message);
        showCoreToast('error', message, 3500);
        return;
      }

      if (result.data?.overview) {
        setCreditOverview(result.data.overview);
      }

      const message = result.message ?? t('moa_mypage.msg.attendance_success');
      setAttendanceMessage(message);
      showCoreToast('success', message, 3000);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const userPoint = currentUser?.point ?? 0;
  const creditBalance = creditOverview?.balance ?? userPoint;

  return {
    creditOverview,
    creditLoading,
    creditError,
    attendanceLoading,
    attendanceMessage,
    creditBalance,
    handleAttendanceCheck,
  };
}
