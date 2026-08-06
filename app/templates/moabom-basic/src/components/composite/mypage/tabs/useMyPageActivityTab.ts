import { useCallback, useEffect, useRef, useState } from 'react';
import type { MoabomTranslateFn } from '../../../../i18n/moabomT';
import { navigateMoabomShellPath } from '../../../../shell/navigateMoabomShellPath';
import { openMyPageActivityBoard, type OpenMyPageActivityBoard } from '../myPageActivityBoard';
import { fetchUserActivitiesApi, fetchUserAppReviewsApi } from '../myPageApi';
import type { ActivityItem, ActivityOverview, MyPageTab, MyPageUser } from '../myPageTypes';

const ACTIVITY_PAGE_SIZE = 10;

function fetchActivityPage(filter: string, offset: number) {
  const pagination = { limit: ACTIVITY_PAGE_SIZE, offset };
  return filter === 'reviews'
    ? fetchUserAppReviewsApi(pagination)
    : fetchUserActivitiesApi(filter, pagination);
}

interface UseMyPageActivityTabOptions {
  activeTab: MyPageTab;
  currentUser: MyPageUser | null;
  t: MoabomTranslateFn;
  onOpenBoard?: OpenMyPageActivityBoard;
}

export function useMyPageActivityTab({
  activeTab,
  currentUser,
  t,
  onOpenBoard,
}: UseMyPageActivityTabOptions) {
  const [activityOverview, setActivityOverview] = useState<ActivityOverview | null>(null);
  const [activityFilter, setActivityFilter] = useState('all');
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const [activityError, setActivityError] = useState('');
  const loadedDataKeyRef = useRef<string | null>(null);

  const memberKey = currentUser?.memberKey ?? (currentUser ? 'authenticated' : '');

  useEffect(() => {
    if (activeTab !== 'activity' || !memberKey) return;

    let cancelled = false;
    const dataKey = `${memberKey}:${activityFilter}`;
    const hasCurrentData = loadedDataKeyRef.current === dataKey;
    if (!hasCurrentData) {
      setActivityOverview(null);
      setActivityLoading(true);
    }
    setActivityError('');

    void (async () => {
      try {
        const result = await fetchActivityPage(activityFilter, 0);
        if (cancelled) return;

        if (!result.ok || !result.data) {
          if (!hasCurrentData) {
            setActivityOverview(null);
          }
          setActivityError(result.message ?? t('moa_mypage.msg.activity_load_failed'));
          return;
        }

        loadedDataKeyRef.current = dataKey;
        setActivityOverview(result.data);
      } catch {
        if (!cancelled) {
          if (!hasCurrentData) {
            setActivityOverview(null);
          }
          setActivityError(t('moa_mypage.msg.activity_load_failed'));
        }
      } finally {
        if (!cancelled) {
          setActivityLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, activityFilter, memberKey]);

  const loadMoreActivities = useCallback(async () => {
    if (!activityOverview?.pagination?.has_more || activityLoadingMore || activityLoading) {
      return;
    }

    setActivityLoadingMore(true);
    setActivityError('');

    try {
      const result = await fetchActivityPage(activityFilter, activityOverview.items.length);

      if (!result.ok || !result.data) {
        setActivityError(result.message ?? t('moa_mypage.msg.activity_load_failed'));
        return;
      }

      setActivityOverview(prev => {
        if (!prev) {
          return result.data ?? null;
        }

        return {
          ...result.data!,
          items: [...prev.items, ...(result.data?.items ?? [])],
        };
      });
    } catch {
      setActivityError(t('moa_mypage.msg.activity_load_failed'));
    } finally {
      setActivityLoadingMore(false);
    }
  }, [activityFilter, activityLoading, activityLoadingMore, activityOverview, t]);

  const handleOpenActivity = (item: ActivityItem) => {
    if (openMyPageActivityBoard(onOpenBoard, item)) {
      return;
    }

    if (!item.target_url) {
      return;
    }

    if (navigateMoabomShellPath(item.target_url)) {
      return;
    }

    window.location.href = item.target_url;
  };

  const activityHasMore = Boolean(activityOverview?.pagination?.has_more);

  return {
    activityOverview,
    activityFilter,
    setActivityFilter,
    activityLoading,
    activityLoadingMore,
    activityHasMore,
    activityError,
    handleOpenActivity,
    loadMoreActivities,
  };
}
