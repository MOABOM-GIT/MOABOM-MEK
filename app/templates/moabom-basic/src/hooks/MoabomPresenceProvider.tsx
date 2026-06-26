import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  acceptPresenceFriend,
  fetchPresenceFriends,
  fetchPresenceOnlineUsers,
  fetchPresenceSettings,
  fetchPresenceSummary,
  removePresenceFriend,
  requestPresenceFriend,
  sendPresenceHeartbeat,
  type PresenceHeartbeatTouch,
  type OwnPresenceState,
  type PresenceAvailability,
  type PresenceFriend,
  type PresenceOnlineUser,
  type PresenceSettings,
  type PresenceSubtitleMode,
  type PresenceSummary,
} from '../api/moabomPresenceApi';
import {
  subscribePresenceRevisionChannel,
  unsubscribePresenceRevisionChannel,
} from '../runtime/moabomPresenceSocket';
import {
  noteShellPresenceRevision,
  registerShellPlatformSummaryInvalidate,
  registerShellPresenceInvalidate,
} from '../shell/ShellRealtimeStore';
import {
  installMoabomShellRealtimeCoordinator,
  startMoabomShellRealtimeCoordinator,
  stopMoabomShellRealtimeCoordinator,
} from '../runtime/moabomShellRealtimeCoordinator';
import {
  startMoabomShellChatSyncService,
  stopMoabomShellChatSyncService,
} from '../runtime/moabomShellChatSyncService';
import {
  ensureMoabomChatNotificationPermission,
  installMoabomShellChatBackgroundNotify,
} from '../runtime/moabomShellChatBackgroundNotify';
import {
  installShellChatInboxCacheBridge,
} from '../shell/moabomShellChatInboxCache';
import { installShellNotificationBridge } from '../shell/moabomShellNotificationBridge';
import { MOABOM_WEBSOCKET_AUTH_SYNCED_EVENT, syncMoabomWebSocketAuth } from '../runtime/moabomWebSocketAuthSync';
import {
  isMoabomWebSocketConnected,
  subscribeMoabomWebSocketConnectionChange,
} from '../runtime/moabomWebSocketConnection';
import { useMoabomShellT } from '../i18n/MoabomUiI18nProvider';
import {
  MOABOM_PRESENCE_SETTINGS_OPTIMISTIC_EVENT,
  type PresenceSettingsOptimisticDetail,
} from '../components/composite/mypage/tabs/useMyPagePresenceSettings';
import {
  resolveShellPresenceActivityText,
} from '../shell/moaShellPresenceActivity';
import { deferShellSecondaryWork } from '../shell/moaShellDeferredWork';
import { resolveClientFormFactor } from '../utils/clientFormFactor';
import {
  normalizePresenceConnectList,
  rememberPresenceSessionKey,
  shouldRefreshConnectListAfterHeartbeat,
} from '../shell/presenceConnectSync';
import {
  applyOptimisticLoginToOnlineUsers,
  applyOptimisticLogoutToOnlineUsers,
} from '../shell/presenceLoginBridge';
import {
  notifyMoabomPresenceFriendsChanged,
  subscribeMoabomPresenceFriendsChanged,
} from '../shell/moabomPresenceFriendsSync';
import {
  applyPendingSelfPresenceToFriends,
  applyPendingSelfPresenceToOnlineUsers,
  buildOwnPresenceFromSettings,
  getShellAuthUserBio,
  getShellAuthUserAvatar,
  getShellAuthUserUuid,
  patchFriendsSelfPresence,
  patchOnlineUsersSelfPresence,
  presenceReachableFromAvailability,
  resolvePresenceSubtitleForMode,
  type LocalPendingPresenceSettings,
} from '../utils/presenceSettingsSync';

export interface MoabomPresenceContextValue {
  summary: PresenceSummary | null;
  onlineUsers: PresenceOnlineUser[];
  friends: PresenceFriend[];
  ownPresence: OwnPresenceState | null;
  presenceSettings: PresenceSettings | null;
  presenceSettingsHydrated: boolean;
  presenceSettingsLoading: boolean;
  applyPresenceSettingsSnapshot: (settings: PresenceSettings) => void;
  loadingOnline: boolean;
  loadingFriends: boolean;
  refreshOnline: () => Promise<void>;
  refreshFriends: () => Promise<void>;
  addFriend: (userUuid: string) => Promise<void>;
  acceptFriend: (userUuid: string) => Promise<void>;
  removeFriend: (userUuid: string) => Promise<void>;
}

const MoabomPresenceContext = createContext<MoabomPresenceContextValue | null>(null);

export interface MoabomPresenceProviderProps {
  isLoggedIn: boolean;
  children: React.ReactNode;
}

/**
 * 셸 SSOT — heartbeat·Reverb 구독·접속 설정 동기화.
 * UI 패널(RightPanel)과 분리해 우측 패널 닫힘·탭 전환과 무관하게 세션을 유지한다.
 */
export function MoabomPresenceProvider({ isLoggedIn, children }: MoabomPresenceProviderProps) {
  const { t } = useMoabomShellT();
  const [summary, setSummary] = useState<PresenceSummary | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<PresenceOnlineUser[]>([]);
  const [friends, setFriends] = useState<PresenceFriend[]>([]);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [ownPresence, setOwnPresence] = useState<OwnPresenceState | null>(null);
  const [presenceSettings, setPresenceSettings] = useState<PresenceSettings | null>(null);
  const [presenceSettingsHydrated, setPresenceSettingsHydrated] = useState(false);
  const [presenceSettingsLoading, setPresenceSettingsLoading] = useState(false);

  const ownPresenceRef = useRef<OwnPresenceState | null>(null);
  const settingsHydratedRef = useRef(false);
  /** 로그인 직후 presence 채널 재구독 트리거 (WebSocket auth 동기화) */
  const [wsAuthEpoch, setWsAuthEpoch] = useState(0);
  const wasLoggedInRef = useRef(isLoggedIn);
  const selfUserUuidRef = useRef<string | null>(getShellAuthUserUuid());
  const sessionBootstrappedRef = useRef(false);
  /** 저장 완료 전 heartbeat·API 재조회가 낙관적 설정을 덮어쓰지 않도록 보호 */
  const localPendingSettingsRef = useRef<LocalPendingPresenceSettings | null>(null);
  const heartbeatDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    ownPresenceRef.current = ownPresence;
  }, [ownPresence]);

  const applyOwnPresencePatch = useCallback((patch: OwnPresenceState) => {
    ownPresenceRef.current = patch;
    setOwnPresence(patch);
  }, []);

  const patchSelfPresenceOnLists = useCallback((
    nextOwn: OwnPresenceState,
    presenceSubtitle: string | null | undefined = nextOwn.presence_subtitle,
  ) => {
    const viewerUuid = getShellAuthUserUuid();
    if (!viewerUuid) {
      return;
    }

    const rowPatch = {
      availability: nextOwn.availability,
      isReachable: nextOwn.is_reachable,
      presenceSubtitle: presenceSubtitle ?? null,
    };

    setOnlineUsers(prev => patchOnlineUsersSelfPresence(prev, viewerUuid, rowPatch));
    setFriends(prev => patchFriendsSelfPresence(prev, viewerUuid, rowPatch));
  }, []);

  const applyPresenceSettingsOptimistic = useCallback((detail: PresenceSettingsOptimisticDetail) => {
    if (!detail) {
      return;
    }

    const context = {
      profileBio: detail.profile_bio ?? getShellAuthUserBio(),
      activityText: resolveShellPresenceActivityText(t),
    };
    const nextOwn = buildOwnPresenceFromSettings(detail, ownPresenceRef.current, context);

    if (detail.pending) {
      localPendingSettingsRef.current = {
        availability: nextOwn.availability,
        subtitle_mode: nextOwn.subtitle_mode,
        presence_subtitle: nextOwn.presence_subtitle ?? null,
      };
    }

    applyOwnPresencePatch(nextOwn);
    patchSelfPresenceOnLists(nextOwn);

    if (
      detail.show_avatar_in_connect_list !== undefined
      || detail.accept_chat_requests !== undefined
    ) {
      setPresenceSettings(prev => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          ...(detail.show_avatar_in_connect_list !== undefined
            ? { show_avatar_in_connect_list: detail.show_avatar_in_connect_list }
            : {}),
          ...(detail.accept_chat_requests !== undefined
            ? { accept_chat_requests: detail.accept_chat_requests }
            : {}),
        };
      });
    }

    if (detail.show_avatar_in_connect_list !== undefined) {
      const viewerUuid = getShellAuthUserUuid();
      if (viewerUuid) {
        const avatar = detail.show_avatar_in_connect_list ? getShellAuthUserAvatar() : null;
        setOnlineUsers(prev => patchOnlineUsersSelfPresence(prev, viewerUuid, { avatar }));
        setFriends(prev => patchFriendsSelfPresence(prev, viewerUuid, { avatar }));
      }
    }
  }, [applyOwnPresencePatch, patchSelfPresenceOnLists, t]);

  const applyActivitySubtitleLocally = useCallback(() => {
    const own = ownPresenceRef.current;
    if (!own || own.subtitle_mode !== 'activity') {
      return;
    }

    const activityText = resolveShellPresenceActivityText(t);
    const nextOwn: OwnPresenceState = {
      ...own,
      presence_subtitle: activityText,
    };

    if (localPendingSettingsRef.current) {
      localPendingSettingsRef.current = {
        ...localPendingSettingsRef.current,
        presence_subtitle: activityText,
      };
    }

    applyOwnPresencePatch(nextOwn);
    patchSelfPresenceOnLists(nextOwn, activityText);
  }, [applyOwnPresencePatch, patchSelfPresenceOnLists, t]);

  const refreshSummary = useCallback(async () => {
    try {
      const next = await fetchPresenceSummary();
      noteShellPresenceRevision(next.revision);
      setSummary(next);
    } catch {
      setSummary(null);
    }
  }, []);

  const refreshOnline = useCallback(async () => {
    setLoadingOnline(true);
    try {
      const payload = await fetchPresenceOnlineUsers();
      noteShellPresenceRevision(payload.revision);
      setOnlineUsers(applyPendingSelfPresenceToOnlineUsers(
        normalizePresenceConnectList(payload.users),
        getShellAuthUserUuid(),
        ownPresenceRef.current,
        localPendingSettingsRef.current,
      ));
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
      const rows = await fetchPresenceFriends();
      setFriends(applyPendingSelfPresenceToFriends(
        rows,
        getShellAuthUserUuid(),
        ownPresenceRef.current,
        localPendingSettingsRef.current,
      ));
    } catch {
      setFriends([]);
    } finally {
      setLoadingFriends(false);
    }
  }, [isLoggedIn]);

  const applyPresenceSettingsSnapshot = useCallback((settings: PresenceSettings) => {
    setPresenceSettings(settings);
    setPresenceSettingsHydrated(true);
    setPresenceSettingsLoading(false);
    settingsHydratedRef.current = true;
  }, []);

  const hydrateOwnSettings = useCallback(async (): Promise<PresenceSubtitleMode | null> => {
    if (!isLoggedIn) {
      settingsHydratedRef.current = false;
      ownPresenceRef.current = null;
      setOwnPresence(null);
      setPresenceSettings(null);
      setPresenceSettingsHydrated(false);
      setPresenceSettingsLoading(false);
      return null;
    }
    setPresenceSettingsLoading(true);
    try {
      const settings = await fetchPresenceSettings();
      applyPresenceSettingsSnapshot(settings);
      const pending = localPendingSettingsRef.current;
      const availability = pending?.availability ?? settings.availability;
      const subtitleMode = pending?.subtitle_mode ?? settings.subtitle_mode;
      const context = {
        profileBio: getShellAuthUserBio(),
        activityText: resolveShellPresenceActivityText(t),
      };
      applyOwnPresencePatch({
        availability,
        subtitle_mode: subtitleMode,
        presence_subtitle: pending?.presence_subtitle
          ?? resolvePresenceSubtitleForMode(subtitleMode, context),
        is_reachable: presenceReachableFromAvailability(availability),
      });
      return settings.subtitle_mode;
    } catch {
      setPresenceSettingsLoading(false);
      return ownPresenceRef.current?.subtitle_mode ?? null;
    }
  }, [applyOwnPresencePatch, applyPresenceSettingsSnapshot, isLoggedIn, t]);

  const runHeartbeat = useCallback(async (options?: {
    skipSummaryRefresh?: boolean;
    refreshConnectList?: boolean;
    touch?: PresenceHeartbeatTouch;
  }) => {
    try {
      let subtitleMode = ownPresenceRef.current?.subtitle_mode;
      if (isLoggedIn && !settingsHydratedRef.current) {
        subtitleMode = await hydrateOwnSettings();
      }
      const statusText = subtitleMode === 'activity'
        ? resolveShellPresenceActivityText(t)
        : null;
      const heartbeat = await sendPresenceHeartbeat(
        statusText,
        resolveClientFormFactor(),
        options?.touch,
      );
      if (heartbeat.session_key) {
        rememberPresenceSessionKey(heartbeat.session_key);
      }
      noteShellPresenceRevision(heartbeat.revision);
      if (heartbeat.availability) {
        const pending = localPendingSettingsRef.current;
        const availability = pending?.availability ?? heartbeat.availability;
        const resolvedSubtitleMode = pending?.subtitle_mode
          ?? heartbeat.subtitle_mode
          ?? subtitleMode
          ?? 'profile_bio';
        const presenceSubtitle = pending?.presence_subtitle
          ?? heartbeat.presence_subtitle
          ?? null;
        applyOwnPresencePatch({
          availability,
          subtitle_mode: resolvedSubtitleMode,
          presence_subtitle: presenceSubtitle,
          is_reachable: pending?.availability
            ? presenceReachableFromAvailability(pending.availability)
            : (heartbeat.is_reachable ?? heartbeat.availability !== 'offline'),
        });
        if (pending) {
          patchSelfPresenceOnLists({
            availability,
            subtitle_mode: resolvedSubtitleMode,
            presence_subtitle: presenceSubtitle,
            is_reachable: presenceReachableFromAvailability(availability),
          }, presenceSubtitle);
        }
      }

      const refreshTasks: Promise<void>[] = [];
      if (options?.refreshConnectList && shouldRefreshConnectListAfterHeartbeat(heartbeat)) {
        refreshTasks.push(refreshOnline());
      }
      if (!options?.skipSummaryRefresh) {
        refreshTasks.push(refreshSummary());
      }
      if (refreshTasks.length > 0) {
        await Promise.all(refreshTasks);
      }

      return heartbeat;
    } catch {
      return null;
    }
  }, [applyOwnPresencePatch, hydrateOwnSettings, isLoggedIn, patchSelfPresenceOnLists, refreshOnline, refreshSummary, t]);

  const scheduleDebouncedHeartbeat = useCallback((options?: {
    skipSummaryRefresh?: boolean;
    refreshConnectList?: boolean;
    touch?: PresenceHeartbeatTouch;
  }) => {
    if (heartbeatDebounceRef.current !== null) {
      clearTimeout(heartbeatDebounceRef.current);
    }
    heartbeatDebounceRef.current = setTimeout(() => {
      heartbeatDebounceRef.current = null;
      void runHeartbeat(options);
    }, 1500);
  }, [runHeartbeat]);

  const confirmPresenceSettingsOnServer = useCallback(async () => {
    localPendingSettingsRef.current = null;
    await runHeartbeat();
    await Promise.all([refreshOnline(), refreshFriends()]);
  }, [refreshFriends, refreshOnline, runHeartbeat]);

  useEffect(() => {
    if (sessionBootstrappedRef.current) {
      return;
    }
    sessionBootstrappedRef.current = true;
    deferShellSecondaryWork(() => {
      void (async () => {
        await refreshSummary();
        await runHeartbeat({ skipSummaryRefresh: true, refreshConnectList: true });
      })();
    }, 120);
  }, [refreshSummary, runHeartbeat]);

  useEffect(() => {
    const wasLoggedIn = wasLoggedInRef.current;
    if (wasLoggedIn === isLoggedIn) {
      return;
    }
    wasLoggedInRef.current = isLoggedIn;

    settingsHydratedRef.current = false;
    localPendingSettingsRef.current = null;
    setPresenceSettings(null);
    setPresenceSettingsHydrated(false);
    setPresenceSettingsLoading(false);

    if (isLoggedIn) {
      selfUserUuidRef.current = getShellAuthUserUuid();
      setOnlineUsers(prev => applyOptimisticLoginToOnlineUsers(prev, ownPresenceRef.current));
      void (async () => {
        await runHeartbeat({
          touch: 'login',
          skipSummaryRefresh: true,
          refreshConnectList: false,
        });
        await Promise.all([
          refreshSummary(),
          refreshOnline(),
          refreshFriends(),
          hydrateOwnSettings(),
        ]);
      })();
      return;
    }

    const loggedOutUuid = selfUserUuidRef.current;
    if (loggedOutUuid) {
      setOnlineUsers(prev => applyOptimisticLogoutToOnlineUsers(prev, loggedOutUuid));
    }
    selfUserUuidRef.current = null;
    void runHeartbeat({ touch: 'logout', refreshConnectList: true });
  }, [
    hydrateOwnSettings,
    isLoggedIn,
    refreshFriends,
    refreshSummary,
    runHeartbeat,
  ]);

  useEffect(() => {
    installMoabomShellRealtimeCoordinator();
    installShellChatInboxCacheBridge();
    installShellNotificationBridge();
    installMoabomShellChatBackgroundNotify();
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      stopMoabomShellRealtimeCoordinator();
      stopMoabomShellChatSyncService();
      return;
    }

    syncMoabomWebSocketAuth(true);
    void ensureMoabomChatNotificationPermission();
    const uuid = getShellAuthUserUuid();
    if (uuid) {
      startMoabomShellRealtimeCoordinator(uuid);
    }
    startMoabomShellChatSyncService();
  }, [isLoggedIn]);

  useEffect(() => {
    const onWsAuthSynced = () => {
      setWsAuthEpoch(epoch => epoch + 1);
    };
    window.addEventListener(MOABOM_WEBSOCKET_AUTH_SYNCED_EVENT, onWsAuthSynced);
    return () => {
      window.removeEventListener(MOABOM_WEBSOCKET_AUTH_SYNCED_EVENT, onWsAuthSynced);
    };
  }, []);

  useEffect(() => {
    const intervalSec = summary?.heartbeat_interval_sec ?? 60;
    const timer = window.setInterval(() => {
      void runHeartbeat({ refreshConnectList: false });
    }, intervalSec * 1000);
    return () => window.clearInterval(timer);
  }, [runHeartbeat, summary?.heartbeat_interval_sec]);

  useEffect(() => {
    return subscribeMoabomWebSocketConnectionChange(() => {
      if (isMoabomWebSocketConnected()) {
        void Promise.all([refreshSummary(), refreshOnline()]);
      }
    });
  }, [refreshOnline, refreshSummary]);

  const invalidatePresenceFromRevision = useCallback(() => {
    void Promise.all([refreshSummary(), refreshOnline()]);
  }, [refreshOnline, refreshSummary]);

  useEffect(() => registerShellPresenceInvalidate(invalidatePresenceFromRevision), [
    invalidatePresenceFromRevision,
  ]);

  useEffect(() => registerShellPlatformSummaryInvalidate(refreshSummary), [refreshSummary]);

  const revisionSubscriptionKeyRef = useRef<string | null>(null);
  const platformRevisionSubscriptionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!summary?.revision_channel) {
      return;
    }

    const subscriptionKey = subscribePresenceRevisionChannel(summary.revision_channel);
    revisionSubscriptionKeyRef.current = subscriptionKey;

    return () => {
      if (revisionSubscriptionKeyRef.current) {
        unsubscribePresenceRevisionChannel(revisionSubscriptionKeyRef.current);
        revisionSubscriptionKeyRef.current = null;
      }
    };
  }, [summary?.revision_channel, wsAuthEpoch]);

  useEffect(() => {
    if (!summary?.platform_revision_channel) {
      return;
    }

    const subscriptionKey = subscribePresenceRevisionChannel(summary.platform_revision_channel);
    platformRevisionSubscriptionKeyRef.current = subscriptionKey;

    return () => {
      if (platformRevisionSubscriptionKeyRef.current) {
        unsubscribePresenceRevisionChannel(platformRevisionSubscriptionKeyRef.current);
        platformRevisionSubscriptionKeyRef.current = null;
      }
    };
  }, [summary?.platform_revision_channel, wsAuthEpoch]);

  useEffect(() => {
    return subscribeMoabomPresenceFriendsChanged(() => {
      void Promise.all([refreshOnline(), refreshFriends()]);
    });
  }, [refreshFriends, refreshOnline]);

  useEffect(() => {
    const handleSettingsChanged = () => {
      void confirmPresenceSettingsOnServer();
    };
    const handleOptimistic = (event: Event) => {
      const detail = (event as CustomEvent<PresenceSettingsOptimisticDetail>).detail;
      if (!detail) {
        return;
      }
      settingsHydratedRef.current = true;
      applyPresenceSettingsOptimistic(detail);
    };
    const handlePresenceContextChanged = () => {
      applyActivitySubtitleLocally();
      if (ownPresenceRef.current?.subtitle_mode === 'activity') {
        scheduleDebouncedHeartbeat({ refreshConnectList: !isMoabomWebSocketConnected() });
      }
    };
    const handlePathChanged = () => {
      applyActivitySubtitleLocally();
      if (ownPresenceRef.current?.subtitle_mode === 'activity') {
        scheduleDebouncedHeartbeat({ refreshConnectList: !isMoabomWebSocketConnected() });
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleDebouncedHeartbeat({ refreshConnectList: !isMoabomWebSocketConnected() });
      }
    };
    const handleWindowFocus = () => {
      scheduleDebouncedHeartbeat({ refreshConnectList: !isMoabomWebSocketConnected() });
    };

    window.addEventListener('moabom-presence-settings-changed', handleSettingsChanged);
    window.addEventListener(MOABOM_PRESENCE_SETTINGS_OPTIMISTIC_EVENT, handleOptimistic);
    window.addEventListener('moabom-shell-presence-context-changed', handlePresenceContextChanged);
    window.addEventListener('moabom-shell-path-changed', handlePathChanged);
    window.addEventListener('popstate', handlePathChanged);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('moabom-presence-settings-changed', handleSettingsChanged);
      window.removeEventListener(MOABOM_PRESENCE_SETTINGS_OPTIMISTIC_EVENT, handleOptimistic);
      window.removeEventListener('moabom-shell-presence-context-changed', handlePresenceContextChanged);
      window.removeEventListener('moabom-shell-path-changed', handlePathChanged);
      window.removeEventListener('popstate', handlePathChanged);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [applyActivitySubtitleLocally, applyPresenceSettingsOptimistic, confirmPresenceSettingsOnServer, scheduleDebouncedHeartbeat]);

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
    notifyMoabomPresenceFriendsChanged();
    await Promise.all([refreshOnline(), refreshFriends()]);
  }, [refreshFriends, refreshOnline]);

  const value = useMemo<MoabomPresenceContextValue>(() => ({
    summary,
    onlineUsers,
    friends,
    ownPresence,
    presenceSettings,
    presenceSettingsHydrated,
    presenceSettingsLoading,
    applyPresenceSettingsSnapshot,
    loadingOnline,
    loadingFriends,
    refreshOnline,
    refreshFriends,
    addFriend,
    acceptFriend,
    removeFriend,
  }), [
    acceptFriend,
    addFriend,
    applyPresenceSettingsSnapshot,
    friends,
    loadingFriends,
    loadingOnline,
    onlineUsers,
    ownPresence,
    presenceSettings,
    presenceSettingsHydrated,
    presenceSettingsLoading,
    refreshFriends,
    refreshOnline,
    removeFriend,
    summary,
  ]);

  return (
    <MoabomPresenceContext.Provider value={value}>
      {children}
    </MoabomPresenceContext.Provider>
  );
}

export function useMoabomPresenceContext(): MoabomPresenceContextValue {
  const ctx = useContext(MoabomPresenceContext);
  if (!ctx) {
    throw new Error('useMoabomPresenceContext must be used within MoabomPresenceProvider');
  }
  return ctx;
}

export function useMoabomPresenceContextOptional(): MoabomPresenceContextValue | null {
  return useContext(MoabomPresenceContext);
}
