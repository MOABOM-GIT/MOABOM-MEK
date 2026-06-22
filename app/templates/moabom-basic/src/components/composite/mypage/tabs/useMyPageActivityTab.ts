import { useCallback, useEffect, useState } from 'react';
import type { MoabomTranslateFn } from '../../../../i18n/moabomT';
import type { MoabomSystemLanguage } from '../../../../types/moabomSystem';
import { openMyPageActivityBoard, type OpenMyPageActivityBoard } from '../myPageActivityBoard';
import { fetchUserActivitiesApi } from '../myPageApi';
import type { ActivityItem, ActivityOverview, MyPageTab, MyPageUser } from '../myPageTypes';

const ACTIVITY_PAGE_SIZE = 10;

interface UseMyPageActivityTabOptions {
  activeTab: MyPageTab;
  currentUser: MyPageUser | null;
  shellLanguage: MoabomSystemLanguage;
  t: MoabomTranslateFn;
  onOpenBoard?: OpenMyPageActivityBoard;
}

export function useMyPageActivityTab({
  activeTab,
  currentUser,
  shellLanguage,
  t,
  onOpenBoard,
}: UseMyPageActivityTabOptions) {
  const [activityOverview, setActivityOverview] = useState<ActivityOverview | null>(null);
  const [activityFilter, setActivityFilter] = useState('all');
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const [activityError, setActivityError] = useState('');

  useEffect(() => {
    if (activeTab !== 'activity' || !currentUser) return;

    let cancelled = false;
    setActivityLoading(true);
    setActivityError('');

    void (async () => {
      try {
        const result = await fetchUserActivitiesApi(activityFilter, {
          limit: ACTIVITY_PAGE_SIZE,
          offset: 0,
        });
        if (cancelled) return;

        if (!result.ok || !result.data) {
          setActivityOverview(null);
          setActivityError(result.message ?? t('moa_mypage.msg.activity_load_failed'));
          return;
        }

        setActivityOverview(result.data);
      } catch {
        if (!cancelled) {
          setActivityOverview(null);
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
  }, [activeTab, currentUser, activityFilter, shellLanguage, t]);

  const loadMoreActivities = useCallback(async () => {
    if (!activityOverview?.pagination?.has_more || activityLoadingMore || activityLoading) {
      return;
    }

    setActivityLoadingMore(true);
    setActivityError('');

    try {
      const result = await fetchUserActivitiesApi(activityFilter, {
        limit: ACTIVITY_PAGE_SIZE,
        offset: activityOverview.items.length,
      });

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

    const G7Core = (window as any).G7Core;
    if (typeof G7Core?.dispatch === 'function') {
      G7Core.dispatch({
        handler: 'navigate',
        params: {
          path: item.target_url,
        },
      });
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
