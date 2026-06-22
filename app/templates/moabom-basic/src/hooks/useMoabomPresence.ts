import { useCallback, useEffect, useRef, useState } from 'react';
import {
  acceptPresenceFriend,
  fetchPresenceFriends,
  fetchPresenceOnlineUsers,
  fetchPresenceSettings,
  fetchPresenceSummary,
  removePresenceFriend,
  requestPresenceFriend,
  sendPresenceHeartbeat,
  type OwnPresenceState,
  type PresenceFriend,
  type PresenceOnlineUser,
  type PresenceSummary,
} from '../api/moabomPresenceApi';
import {
  leaveTenantPresenceChannel,
  subscribeTenantPresenceChannel,
} from '../runtime/moabomPresenceSocket';
import { useMoabomShellT } from '../i18n/MoabomUiI18nProvider';
import {
  MOABOM_PRESENCE_SETTINGS_OPTIMISTIC_EVENT,
  type PresenceSettingsOptimisticDetail,
} from '../components/composite/mypage/tabs/useMyPagePresenceSettings';
import { resolveShellPresenceActivityText } from '../shell/moaShellPresenceActivity';
import { resolveClientFormFactor } from '../utils/clientFormFactor';

interface UseMoabomPresenceOptions {
  isLoggedIn: boolean;
  connectTabActive: boolean;
  friendTabActive: boolean;
}

export function useMoabomPresence({
  isLoggedIn,
  connectTabActive,
  friendTabActive,
}: UseMoabomPresenceOptions) {
  const t = useMoabomShellT();
  const [summary, setSummary] = useState<PresenceSummary | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<PresenceOnlineUser[]>([]);
  const [friends, setFriends] = useState<PresenceFriend[]>([]);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [ownPresence, setOwnPresence] = useState<OwnPresenceState | null>(null);
  const ownPresenceRef = useRef<OwnPresenceState | null>(null);
  const presenceChannelRef = useRef<string | null>(null);

  useEffect(() => {
    ownPresenceRef.current = ownPresence;
  }, [ownPresence]);

  const refreshSummary = useCallback(async () => {
    try {
      const next = await fetchPresenceSummary();
      setSummary(next);
      presenceChannelRef.current = next.presence_channel;
    } catch {
      setSummary(null);
    }
  }, []);

  const refreshOnline = useCallback(async () => {
    setLoadingOnline(true);
    try {
      setOnlineUsers(await fetchPresenceOnlineUsers());
    } catch {
      setOnlineUsers([]);
    } finally {
      setLoadingOnline(false);
    }
  }, []);

  const refreshFriends = useCallback(async () => {
    if (!isLoggedIn) {
      setFriends([]);
      return;
    }
    setLoadingFriends(true);
    try {
      setFriends(await fetchPresenceFriends());
    } catch {
      setFriends([]);
    } finally {
      setLoadingFriends(false);
    }
  }, [isLoggedIn]);

  const refreshOwnSettings = useCallback(async () => {
    if (!isLoggedIn) {
      setOwnPresence(null);
      return;
    }
    try {
      const settings = await fetchPresenceSettings();
      setOwnPresence(prev => ({
        availability: settings.availability,
        subtitle_mode: settings.subtitle_mode,
        presence_subtitle: prev?.presence_subtitle ?? null,
        is_reachable: settings.availability !== 'offline',
      }));
    } catch {
      // settings 실패는 heartbeat 폴백에 맡김
    }
  }, [isLoggedIn]);

  const runHeartbeat = useCallback(async () => {
    try {
      const subtitleMode = ownPresenceRef.current?.subtitle_mode;
      const statusText = subtitleMode === 'activity'
        ? resolveShellPresenceActivityText(t)
        : null;
      const heartbeat = await sendPresenceHeartbeat(statusText, resolveClientFormFactor());
      if (heartbeat.availability) {
        setOwnPresence({
          availability: heartbeat.availability,
          subtitle_mode: heartbeat.subtitle_mode ?? 'profile_bio',
          presence_subtitle: heartbeat.presence_subtitle ?? null,
          is_reachable: heartbeat.is_reachable ?? heartbeat.availability !== 'offline',
        });
      }
      await refreshSummary();
    } catch {
      // heartbeat 실패는 UI 블로킹하지 않음
    }
  }, [refreshSummary, t]);

  useEffect(() => {
    void refreshSummary();
    void runHeartbeat();
    if (isLoggedIn) {
      void refreshOwnSettings();
    }
  }, [isLoggedIn, refreshOwnSettings, refreshSummary, runHeartbeat]);

  useEffect(() => {
    const intervalSec = summary?.heartbeat_interval_sec ?? 60;
    const timer = window.setInterval(() => {
      void runHeartbeat();
    }, intervalSec * 1000);
    return () => window.clearInterval(timer);
  }, [runHeartbeat, summary?.heartbeat_interval_sec]);

  useEffect(() => {
    if (!connectTabActive) {
      return;
    }
    void refreshOnline();
    const timer = window.setInterval(() => {
      void refreshOnline();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [connectTabActive, refreshOnline]);

  useEffect(() => {
    if (!friendTabActive || !isLoggedIn) {
      return;
    }
    void refreshFriends();
    const timer = window.setInterval(() => {
      void refreshFriends();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [friendTabActive, isLoggedIn, refreshFriends]);

  useEffect(() => {
    if (!isLoggedIn || !summary?.presence_channel) {
      return;
    }

    const subscription = subscribeTenantPresenceChannel(summary.presence_channel, {
      onHere: () => {
        void refreshOnline();
      },
      onJoining: () => {
        void refreshOnline();
      },
      onLeaving: () => {
        void refreshOnline();
      },
    });

    return () => {
      if (subscription) {
        subscription.leave();
      } else if (summary.presence_channel) {
        leaveTenantPresenceChannel(summary.presence_channel);
      }
    };
  }, [isLoggedIn, refreshOnline, summary?.presence_channel]);

  const addFriend = useCallback(async (userUuid: string) => {
    await requestPresenceFriend(userUuid);
    await Promise.all([refreshOnline(), refreshFriends()]);
  }, [refreshFriends, refreshOnline]);

  const acceptFriend = useCallback(async (userUuid: string) => {
    await acceptPresenceFriend(userUuid);
    await Promise.all([refreshOnline(), refreshFriends()]);
  }, [refreshFriends, refreshOnline]);

  const removeFriend = useCallback(async (userUuid: string) => {
    await removePresenceFriend(userUuid);
    await Promise.all([refreshOnline(), refreshFriends()]);
  }, [refreshFriends, refreshOnline]);

  useEffect(() => {
    const handleSettingsChanged = () => {
      void refreshOwnSettings();
      void runHeartbeat();
    };
    const handleOptimistic = (event: Event) => {
      const detail = (event as CustomEvent<PresenceSettingsOptimisticDetail>).detail;
      if (!detail?.availability) {
        return;
      }
      setOwnPresence(prev => ({
        availability: detail.availability,
        subtitle_mode: detail.subtitle_mode ?? prev?.subtitle_mode ?? 'profile_bio',
        presence_subtitle: prev?.presence_subtitle ?? null,
        is_reachable: detail.availability !== 'offline',
      }));
      void refreshOnline();
    };
    const handlePresenceContextChanged = () => {
      if (ownPresenceRef.current?.subtitle_mode === 'activity') {
        void runHeartbeat();
      }
    };
    const handlePathChanged = () => {
      if (ownPresenceRef.current?.subtitle_mode === 'activity') {
        void runHeartbeat();
      }
    };
    window.addEventListener('moabom-presence-settings-changed', handleSettingsChanged);
    window.addEventListener(MOABOM_PRESENCE_SETTINGS_OPTIMISTIC_EVENT, handleOptimistic);
    window.addEventListener('moabom-shell-presence-context-changed', handlePresenceContextChanged);
    window.addEventListener('moabom-shell-path-changed', handlePathChanged);
    window.addEventListener('popstate', handlePathChanged);
    return () => {
      window.removeEventListener('moabom-presence-settings-changed', handleSettingsChanged);
      window.removeEventListener(MOABOM_PRESENCE_SETTINGS_OPTIMISTIC_EVENT, handleOptimistic);
      window.removeEventListener('moabom-shell-presence-context-changed', handlePresenceContextChanged);
      window.removeEventListener('moabom-shell-path-changed', handlePathChanged);
      window.removeEventListener('popstate', handlePathChanged);
    };
  }, [refreshOnline, refreshOwnSettings, runHeartbeat]);

  return {
    summary,
    onlineUsers,
    friends,
    ownPresence,
    loadingOnline,
    loadingFriends,
    refreshOnline,
    refreshFriends,
    refreshOwnSettings,
    addFriend,
    acceptFriend,
    removeFriend,
  };
}
