import { useEffect, useState } from 'react';
import type { MoabomTranslateFn } from '../../../../i18n/moabomT';
import type { MoabomSystemLanguage } from '../../../../types/moabomSystem';
import { fetchUserActivitiesApi } from '../myPageApi';
import type { ActivityItem, ActivityOverview, MyPageTab, MyPageUser } from '../myPageTypes';

interface UseMyPageActivityTabOptions {
  activeTab: MyPageTab;
  currentUser: MyPageUser | null;
  shellLanguage: MoabomSystemLanguage;
  t: MoabomTranslateFn;
}

export function useMyPageActivityTab({
  activeTab,
  currentUser,
  shellLanguage,
  t,
}: UseMyPageActivityTabOptions) {
  const [activityOverview, setActivityOverview] = useState<ActivityOverview | null>(null);
  const [activityFilter, setActivityFilter] = useState('all');
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');

  useEffect(() => {
    if (activeTab !== 'activity' || !currentUser) return;

    let cancelled = false;
    setActivityLoading(true);
    setActivityError('');

    void (async () => {
      try {
        const result = await fetchUserActivitiesApi(activityFilter);
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

  const handleOpenActivity = (item: ActivityItem) => {
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

  return {
    activityOverview,
    activityFilter,
    setActivityFilter,
    activityLoading,
    activityError,
    handleOpenActivity,
  };
}
