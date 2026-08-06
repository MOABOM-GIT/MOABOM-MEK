import { useEffect, useState } from 'react';
import type { MoabomTranslateFn } from '../../../../i18n/moabomT';
import {
  fetchMarketingNotificationConsentApi,
  updateMarketingNotificationConsentApi,
} from '../myPageApi';
import type { MyPageTab } from '../myPageTypes';
import { showCoreToast } from '../myPageUtils';

interface UseMyPageNotificationPreferencesOptions {
  activeTab: MyPageTab;
  isLoggedIn: boolean;
  t: MoabomTranslateFn;
}

export function useMyPageNotificationPreferences({
  activeTab,
  isLoggedIn,
  t,
}: UseMyPageNotificationPreferencesOptions) {
  const [marketingEnabled, setMarketingEnabled] = useState(false);
  const [marketingAvailable, setMarketingAvailable] = useState(false);
  const [marketingLoading, setMarketingLoading] = useState(false);
  const [marketingSaving, setMarketingSaving] = useState(false);

  useEffect(() => {
    if (activeTab !== 'settings' || !isLoggedIn) {
      return;
    }

    let cancelled = false;
    setMarketingLoading(true);

    void (async () => {
      try {
        const result = await fetchMarketingNotificationConsentApi();
        if (cancelled) return;

        setMarketingAvailable(result.ok);
        if (result.ok && result.data) {
          setMarketingEnabled(result.data.enabled === true);
        }
      } catch {
        if (!cancelled) {
          setMarketingAvailable(false);
        }
      } finally {
        if (!cancelled) {
          setMarketingLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, isLoggedIn]);

  const setMarketingConsent = async (enabled: boolean) => {
    if (!marketingAvailable || marketingSaving) return;

    setMarketingSaving(true);
    const previous = marketingEnabled;
    setMarketingEnabled(enabled);

    try {
      const result = await updateMarketingNotificationConsentApi(enabled);
      if (!result.ok || !result.data) {
        setMarketingEnabled(previous);
        showCoreToast(
          'error',
          result.message ?? t('moa_mypage.notifications.marketing_save_failed'),
          4000,
        );
        return;
      }

      setMarketingEnabled(result.data.enabled === true);
    } catch {
      setMarketingEnabled(previous);
      showCoreToast(
        'error',
        t('moa_mypage.notifications.marketing_save_failed'),
        4000,
      );
    } finally {
      setMarketingSaving(false);
    }
  };

  return {
    marketingEnabled,
    marketingAvailable,
    marketingLoading,
    marketingSaving,
    setMarketingConsent,
  };
}
