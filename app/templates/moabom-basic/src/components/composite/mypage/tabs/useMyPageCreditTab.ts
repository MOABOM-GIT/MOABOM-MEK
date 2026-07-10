import { useCallback, useEffect, useState } from 'react';
import type { MoabomTranslateFn } from '../../../../i18n/moabomT';
import type { MoabomSystemLanguage } from '../../../../types/moabomSystem';
import { invalidateMoabomActivityLevelCache } from '../../../../hooks/useMoabomActivityLevel';
import { checkAttendanceApi, fetchUserCreditsApi } from '../myPageApi';
import type { CreditOverview, MyPageTab, MyPageUser } from '../myPageTypes';
import { resolveApiMessage, showCoreToast } from '../myPageUtils';

const CREDIT_TRANSACTION_PAGE_SIZE = 8;

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
  const [creditLoadingMore, setCreditLoadingMore] = useState(false);
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
        const result = await fetchUserCreditsApi({
          limit: CREDIT_TRANSACTION_PAGE_SIZE,
          offset: 0,
        });
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

  const loadMoreCredits = useCallback(async () => {
    if (!creditOverview?.pagination?.has_more || creditLoadingMore || creditLoading) {
      return;
    }

    setCreditLoadingMore(true);
    setCreditError('');

    try {
      const result = await fetchUserCreditsApi({
        limit: CREDIT_TRANSACTION_PAGE_SIZE,
        offset: creditOverview.transactions.length,
      });

      if (!result.ok || !result.data) {
        setCreditError(result.message ?? t('moa_mypage.msg.credit_load_failed'));
        return;
      }

      setCreditOverview(prev => {
        if (!prev) {
          return result.data ?? null;
        }

        return {
          ...result.data!,
          transactions: [...prev.transactions, ...(result.data?.transactions ?? [])],
        };
      });
    } catch {
      setCreditError(t('moa_mypage.msg.credit_load_failed'));
    } finally {
      setCreditLoadingMore(false);
    }
  }, [creditLoading, creditLoadingMore, creditOverview, t]);

  const handleAttendanceCheck = async () => {
    setAttendanceLoading(true);
    setAttendanceMessage('');
    setCreditError('');

    try {
      const result = await checkAttendanceApi();
      if (!result.ok) {
        const message = resolveApiMessage(result, t('moa_mypage.msg.attendance_failed'));
        setAttendanceMessage(message);
        showCoreToast('error', message, 3500);
        return;
      }

      if (result.data?.overview) {
        setCreditOverview(result.data.overview);
        invalidateMoabomActivityLevelCache();
        window.dispatchEvent(new CustomEvent('moabom:credit-changed'));
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
  const creditHasMore = Boolean(creditOverview?.pagination?.has_more);

  return {
    creditOverview,
    creditLoading,
    creditLoadingMore,
    creditHasMore,
    creditError,
    attendanceLoading,
    attendanceMessage,
    creditBalance,
    handleAttendanceCheck,
    loadMoreCredits,
  };
}
