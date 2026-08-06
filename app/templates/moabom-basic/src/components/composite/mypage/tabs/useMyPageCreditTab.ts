import { useCallback, useEffect, useRef, useState } from 'react';
import type { MoabomTranslateFn } from '../../../../i18n/moabomT';
import { invalidateMoabomActivityLevelCache } from '../../../../hooks/useMoabomActivityLevel';
import { checkAttendanceApi, fetchUserCreditsApi } from '../myPageApi';
import type { CreditOverview, MyPageTab, MyPageUser } from '../myPageTypes';
import { resolveApiMessage, showCoreToast } from '../myPageUtils';

const CREDIT_TRANSACTION_PAGE_SIZE = 8;

interface UseMyPageCreditTabOptions {
  activeTab: MyPageTab;
  currentUser: MyPageUser | null;
  t: MoabomTranslateFn;
}

export function useMyPageCreditTab({
  activeTab,
  currentUser,
  t,
}: UseMyPageCreditTabOptions) {
  const [creditOverview, setCreditOverview] = useState<CreditOverview | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditLoadingMore, setCreditLoadingMore] = useState(false);
  const [creditError, setCreditError] = useState('');
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceMessage, setAttendanceMessage] = useState('');
  const loadedMemberKeyRef = useRef<string | null>(null);

  const memberKey = currentUser?.memberKey ?? (currentUser ? 'authenticated' : '');

  useEffect(() => {
    if (activeTab !== 'credit' || !memberKey) return;

    let cancelled = false;
    const hasCurrentData = loadedMemberKeyRef.current === memberKey;
    if (!hasCurrentData) {
      setCreditOverview(null);
      setCreditLoading(true);
    }
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

        loadedMemberKeyRef.current = memberKey;
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
  }, [activeTab, memberKey]);

  useEffect(() => {
    const attendance = creditOverview?.attendance;
    if (!attendance?.checked_today || !attendance.next_available_at) return;

    const delay = Math.max(0, new Date(attendance.next_available_at).getTime() - Date.now());
    const timer = window.setTimeout(() => {
      setCreditOverview(prev => prev?.attendance
        ? {
          ...prev,
          attendance: {
            ...prev.attendance,
            checked_today: false,
          },
        }
        : prev);
      setAttendanceMessage('');
    }, Math.min(delay, 2_147_483_647));

    return () => window.clearTimeout(timer);
  }, [creditOverview?.attendance?.checked_today, creditOverview?.attendance?.next_available_at]);

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
        loadedMemberKeyRef.current = memberKey;
        setCreditOverview(result.data.overview);
        // ActivityLevel SSOT — invalidate 단일 진입 (credit-changed 이중 트리거 금지)
        invalidateMoabomActivityLevelCache();
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
  const attendanceChecked = Boolean(creditOverview?.attendance?.checked_today);

  return {
    creditOverview,
    creditLoading,
    creditLoadingMore,
    creditHasMore,
    creditError,
    attendanceLoading,
    attendanceChecked,
    attendanceMessage,
    creditBalance,
    handleAttendanceCheck,
    loadMoreCredits,
  };
}
