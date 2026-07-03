import { useCallback, useEffect, useRef, useState } from 'react';
import type { MoabomTranslateFn } from '../../../../i18n/moabomT';
import {
  updatePresenceSettings,
  type PresenceAvailability,
  type PresenceSettings,
  type PresenceSubtitleMode,
} from '../../../../api/moabomPresenceApi';
import { useMoabomPresenceSettingsOptional } from '../../../../hooks/MoabomPresenceProvider';
import { showCoreToast } from '../myPageUtils';

export const MOABOM_PRESENCE_SETTINGS_OPTIMISTIC_EVENT = 'moabom-presence-settings-optimistic';

export type PresenceSettingsOptimisticDetail = {
  availability?: PresenceAvailability;
  subtitle_mode?: PresenceSubtitleMode;
  show_avatar_in_connect_list?: boolean;
  accept_chat_requests?: boolean;
  /** profile_bio 모드 즉시 반영용(마이페이지 폼 bio 우선) */
  profile_bio?: string | null;
  /** true = 사용자 변경 직후(저장 대기). heartbeat 가 덮어쓰지 않도록 보호 */
  pending?: boolean;
};

interface UseMyPagePresenceSettingsOptions {
  activeTab: string;
  isLoggedIn: boolean;
  t: MoabomTranslateFn;
  profileBio?: string;
}

function dispatchPresenceOptimistic(detail: PresenceSettingsOptimisticDetail): void {
  window.dispatchEvent(new CustomEvent(MOABOM_PRESENCE_SETTINGS_OPTIMISTIC_EVENT, { detail }));
}

function applySettingsToLocalState(
  settings: PresenceSettings,
  setters: {
    setAvailabilityState: (value: PresenceAvailability) => void;
    setSubtitleModeState: (value: PresenceSubtitleMode) => void;
    setShowAvatarInConnectListState: (value: boolean) => void;
    setAcceptChatRequestsState: (value: boolean) => void;
  },
  profileBio: string,
): void {
  setters.setAvailabilityState(settings.availability);
  setters.setSubtitleModeState(settings.subtitle_mode);
  setters.setShowAvatarInConnectListState(settings.show_avatar_in_connect_list ?? true);
  setters.setAcceptChatRequestsState(settings.accept_chat_requests ?? true);
  dispatchPresenceOptimistic({
    availability: settings.availability,
    subtitle_mode: settings.subtitle_mode,
    show_avatar_in_connect_list: settings.show_avatar_in_connect_list,
    accept_chat_requests: settings.accept_chat_requests,
    profile_bio: profileBio.trim() || null,
  });
}

export function useMyPagePresenceSettings({
  activeTab,
  isLoggedIn,
  t,
  profileBio = '',
}: UseMyPagePresenceSettingsOptions) {
  const presenceSettingsContext = useMoabomPresenceSettingsOptional();

  const [availability, setAvailabilityState] = useState<PresenceAvailability>('online');
  const [subtitleMode, setSubtitleModeState] = useState<PresenceSubtitleMode>('activity');
  const [showAvatarInConnectList, setShowAvatarInConnectListState] = useState(true);
  const [acceptChatRequests, setAcceptChatRequestsState] = useState(true);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<Partial<PresenceSettings> | null>(null);
  const availabilityRef = useRef(availability);
  const subtitleModeRef = useRef(subtitleMode);
  const showAvatarInConnectListRef = useRef(showAvatarInConnectList);
  const profileBioRef = useRef(profileBio);

  useEffect(() => {
    profileBioRef.current = profileBio;
  }, [profileBio]);

  useEffect(() => {
    availabilityRef.current = availability;
  }, [availability]);

  useEffect(() => {
    subtitleModeRef.current = subtitleMode;
  }, [subtitleMode]);

  useEffect(() => {
    showAvatarInConnectListRef.current = showAvatarInConnectList;
  }, [showAvatarInConnectList]);

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
      setShowAvatarInConnectListState(saved.show_avatar_in_connect_list ?? true);
      setAcceptChatRequestsState(saved.accept_chat_requests ?? true);
      presenceSettingsContext?.applyPresenceSettingsSnapshot(saved);
      dispatchPresenceOptimistic({
        availability: saved.availability,
        subtitle_mode: saved.subtitle_mode,
        show_avatar_in_connect_list: saved.show_avatar_in_connect_list,
        accept_chat_requests: saved.accept_chat_requests,
      });
      window.dispatchEvent(new CustomEvent('moabom-presence-settings-changed'));
    } catch {
      setError(t('moa_mypage.presence.save_failed'));
      showCoreToast('error', t('moa_mypage.presence.save_failed'), 4500);
    } finally {
      setSaving(false);
    }
  }, [presenceSettingsContext, t]);

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

  const presenceOptimisticBase = useCallback((): PresenceSettingsOptimisticDetail => ({
    availability: availabilityRef.current,
    subtitle_mode: subtitleModeRef.current,
    profile_bio: profileBioRef.current.trim() || null,
  }), []);

  const setAvailability = useCallback((value: PresenceAvailability) => {
    setAvailabilityState(value);
    if (!hydratedRef.current) {
      return;
    }
    dispatchPresenceOptimistic({
      ...presenceOptimisticBase(),
      availability: value,
      pending: true,
    });
    schedulePresenceSave({ availability: value });
  }, [presenceOptimisticBase, schedulePresenceSave]);

  const setSubtitleMode = useCallback((value: PresenceSubtitleMode) => {
    setSubtitleModeState(value);
    if (!hydratedRef.current) {
      return;
    }
    dispatchPresenceOptimistic({
      ...presenceOptimisticBase(),
      subtitle_mode: value,
      pending: true,
    });
    schedulePresenceSave({ subtitle_mode: value });
  }, [presenceOptimisticBase, schedulePresenceSave]);

  const setShowAvatarInConnectList = useCallback((value: boolean) => {
    setShowAvatarInConnectListState(value);
    if (!hydratedRef.current) {
      return;
    }
    dispatchPresenceOptimistic({
      ...presenceOptimisticBase(),
      show_avatar_in_connect_list: value,
      pending: true,
    });
    schedulePresenceSave({ show_avatar_in_connect_list: value });
  }, [presenceOptimisticBase, schedulePresenceSave]);

  const setAcceptChatRequests = useCallback((value: boolean) => {
    setAcceptChatRequestsState(value);
    if (!hydratedRef.current) {
      return;
    }
    dispatchPresenceOptimistic({
      ...presenceOptimisticBase(),
      accept_chat_requests: value,
      pending: true,
    });
    schedulePresenceSave({ accept_chat_requests: value });
  }, [presenceOptimisticBase, schedulePresenceSave]);

  useEffect(() => {
    if (activeTab !== 'profile' || !isLoggedIn) {
      hydratedRef.current = false;
      return;
    }

    setFallbackError(null);

    if (pendingSaveRef.current) {
      return;
    }

    if (presenceSettingsContext) {
      if (presenceSettingsContext.presenceSettingsHydrated && presenceSettingsContext.presenceSettings) {
        applySettingsToLocalState(
          presenceSettingsContext.presenceSettings,
          {
            setAvailabilityState,
            setSubtitleModeState,
            setShowAvatarInConnectListState,
            setAcceptChatRequestsState,
          },
          profileBioRef.current,
        );
        hydratedRef.current = true;
        return;
      }

      if (presenceSettingsContext.presenceSettingsLoading) {
        hydratedRef.current = false;
        return;
      }

      hydratedRef.current = false;
      return;
    }

    let cancelled = false;
    hydratedRef.current = false;
    setFallbackLoading(true);

    void (async () => {
      try {
        const { fetchPresenceSettings } = await import('../../../../api/moabomPresenceApi');
        const settings = await fetchPresenceSettings();
        if (cancelled) return;
        applySettingsToLocalState(
          settings,
          {
            setAvailabilityState,
            setSubtitleModeState,
            setShowAvatarInConnectListState,
            setAcceptChatRequestsState,
          },
          profileBioRef.current,
        );
      } catch {
        if (!cancelled) {
          setFallbackError(t('moa_mypage.presence.load_failed'));
        }
      } finally {
        if (!cancelled) {
          setFallbackLoading(false);
          hydratedRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
      hydratedRef.current = false;
    };
  }, [
    activeTab,
    isLoggedIn,
    presenceSettingsContext,
    presenceSettingsContext?.presenceSettings,
    presenceSettingsContext?.presenceSettingsHydrated,
    presenceSettingsContext?.presenceSettingsLoading,
    t,
  ]);

  useEffect(() => {
    if (!hydratedRef.current || subtitleModeRef.current !== 'profile_bio') {
      return;
    }
    dispatchPresenceOptimistic({
      ...presenceOptimisticBase(),
      profile_bio: profileBio.trim() || null,
    });
  }, [presenceOptimisticBase, profileBio]);

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

  const loading = presenceSettingsContext
    ? (presenceSettingsContext.presenceSettingsLoading && !presenceSettingsContext.presenceSettingsHydrated)
    : fallbackLoading;
  const resolvedError = error ?? fallbackError;

  return {
    availability,
    setAvailability,
    subtitleMode,
    setSubtitleMode,
    showAvatarInConnectList,
    setShowAvatarInConnectList,
    acceptChatRequests,
    setAcceptChatRequests,
    presenceLoading: loading,
    presenceSaving: saving,
    presenceError: resolvedError,
  };
}
