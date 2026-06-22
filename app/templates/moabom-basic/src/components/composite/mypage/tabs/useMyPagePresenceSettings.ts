import { useCallback, useEffect, useRef, useState } from 'react';
import type { MoabomTranslateFn } from '../../../../i18n/moabomT';
import {
  fetchPresenceSettings,
  updatePresenceSettings,
  type PresenceAvailability,
  type PresenceSettings,
  type PresenceSubtitleMode,
} from '../../../../api/moabomPresenceApi';
import { showCoreToast } from '../myPageUtils';

export const MOABOM_PRESENCE_SETTINGS_OPTIMISTIC_EVENT = 'moabom-presence-settings-optimistic';

export type PresenceSettingsOptimisticDetail = {
  availability: PresenceAvailability;
  subtitle_mode: PresenceSubtitleMode;
};

interface UseMyPagePresenceSettingsOptions {
  activeTab: string;
  isLoggedIn: boolean;
  t: MoabomTranslateFn;
}

function dispatchPresenceOptimistic(detail: PresenceSettingsOptimisticDetail): void {
  window.dispatchEvent(new CustomEvent(MOABOM_PRESENCE_SETTINGS_OPTIMISTIC_EVENT, { detail }));
}

export function useMyPagePresenceSettings({
  activeTab,
  isLoggedIn,
  t,
}: UseMyPagePresenceSettingsOptions) {
  const [availability, setAvailabilityState] = useState<PresenceAvailability>('online');
  const [subtitleMode, setSubtitleModeState] = useState<PresenceSubtitleMode>('profile_bio');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<Partial<PresenceSettings> | null>(null);
  const availabilityRef = useRef(availability);
  const subtitleModeRef = useRef(subtitleMode);

  useEffect(() => {
    availabilityRef.current = availability;
  }, [availability]);

  useEffect(() => {
    subtitleModeRef.current = subtitleMode;
  }, [subtitleMode]);

  const flushPresenceSave = useCallback(async () => {
    const payload = pendingSaveRef.current;
    if (!payload) {
      return;
    }
    pendingSaveRef.current = null;
    setSaving(true);
    setError(null);
    try {
      const saved = await updatePresenceSettings(payload);
      setAvailabilityState(saved.availability);
      setSubtitleModeState(saved.subtitle_mode);
      dispatchPresenceOptimistic({
        availability: saved.availability,
        subtitle_mode: saved.subtitle_mode,
      });
      window.dispatchEvent(new CustomEvent('moabom-presence-settings-changed'));
    } catch {
      setError(t('moa_mypage.presence.save_failed'));
      showCoreToast('error', t('moa_mypage.presence.save_failed'), 4500);
    } finally {
      setSaving(false);
    }
  }, [t]);

  const schedulePresenceSave = useCallback((patch: Partial<PresenceSettings>) => {
    pendingSaveRef.current = {
      ...pendingSaveRef.current,
      ...patch,
    };
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void flushPresenceSave();
    }, 280);
  }, [flushPresenceSave]);

  const setAvailability = useCallback((value: PresenceAvailability) => {
    setAvailabilityState(value);
    if (!hydratedRef.current) {
      return;
    }
    dispatchPresenceOptimistic({
      availability: value,
      subtitle_mode: subtitleModeRef.current,
    });
    schedulePresenceSave({ availability: value });
  }, [schedulePresenceSave]);

  const setSubtitleMode = useCallback((value: PresenceSubtitleMode) => {
    setSubtitleModeState(value);
    if (!hydratedRef.current) {
      return;
    }
    dispatchPresenceOptimistic({
      availability: availabilityRef.current,
      subtitle_mode: value,
    });
    schedulePresenceSave({ subtitle_mode: value });
    if (value === 'activity') {
      window.dispatchEvent(new CustomEvent('moabom-presence-settings-changed'));
    }
  }, [schedulePresenceSave]);

  useEffect(() => {
    if (activeTab !== 'profile' || !isLoggedIn) {
      hydratedRef.current = false;
      return;
    }

    let cancelled = false;
    hydratedRef.current = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const settings = await fetchPresenceSettings();
        if (cancelled) return;
        setAvailabilityState(settings.availability);
        setSubtitleModeState(settings.subtitle_mode);
        dispatchPresenceOptimistic({
          availability: settings.availability,
          subtitle_mode: settings.subtitle_mode,
        });
      } catch {
        if (!cancelled) {
          setError(t('moa_mypage.presence.load_failed'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          hydratedRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
      hydratedRef.current = false;
    };
  }, [activeTab, isLoggedIn, t]);

  useEffect(() => {
    if (subtitleMode !== 'activity') {
      return;
    }
    const handleContextChanged = () => {
      if (hydratedRef.current) {
        window.dispatchEvent(new CustomEvent('moabom-presence-settings-changed'));
      }
    };
    window.addEventListener('moabom-shell-presence-context-changed', handleContextChanged);
    window.addEventListener('moabom-shell-path-changed', handleContextChanged);
    window.addEventListener('popstate', handleContextChanged);
    return () => {
      window.removeEventListener('moabom-shell-presence-context-changed', handleContextChanged);
      window.removeEventListener('moabom-shell-path-changed', handleContextChanged);
      window.removeEventListener('popstate', handleContextChanged);
    };
  }, [subtitleMode]);

  useEffect(() => () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
  }, []);

  return {
    availability,
    setAvailability,
    subtitleMode,
    setSubtitleMode,
    presenceLoading: loading,
    presenceSaving: saving,
    presenceError: error,
  };
}
