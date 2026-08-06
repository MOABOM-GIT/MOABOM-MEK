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
  type PresenceFriend,
  type PresenceOnlinePayload,
  type PresenceOnlineUser,
  type PresenceSettings,
  type PresenceSubtitleMode,
  type PresenceSummary,
} from '../api/moabomPresenceApi';
import {
  type PresenceMember,
  type PresenceSocketSubscription,
  subscribePresenceFriendsChannel,
  subscribePresenceMemberStateChannel,
  subscribeTenantPresenceChannel,
  subscribePresenceRevisionChannel,
  unsubscribePresenceRevisionChannel,
} from '../runtime/moabomPresenceSocket';
import {
  noteShellPresenceRevision,
  registerShellPlatformSummaryInvalidate,
  registerShellPresenceInvalidate,
  type PresenceRefetchTargets,
} from '../shell/ShellRealtimeStore';
import {
  installMoabomShellRealtimeCoordinator,
} from '../runtime/moabomShellRealtimeCoordinator';
import {
  MOABOM_REALTIME_STATE_SYNCED_EVENT,
  type MoabomRealtimeState,
} from '../runtime/moabomShellChatSyncService';
import {
  installMoabomShellChatBackgroundNotify,
} from '../runtime/moabomShellChatBackgroundNotify';
import {
  installMoabomFcmServiceWorkerBridge,
  registerMoabomFcmDeviceToken,
} from '../runtime/moabomFcmClient';
import {
  installShellChatInboxCacheBridge,
} from '../shell/moabomShellChatInboxCache';
import { installShellNotificationBridge } from '../shell/moabomShellNotificationBridge';
import { useShellAuthStateKey } from '../shell/moaShellAuthStateKey';
import { MOABOM_WEBSOCKET_AUTH_SYNCED_EVENT, syncMoabomWebSocketAuth } from '../runtime/moabomWebSocketAuthSync';
import {
  isMoabomWebSocketConnected,
  subscribeMoabomWebSocketConnectionChange,
} from '../runtime/moabomWebSocketConnection';
import {
  bindMoabomShellRealtimeSession,
  installMoabomShellRealtimeSessionTokenListener,
} from '../runtime/moabomShellRealtimeDemand';
import { getShellAccessScopeKey, hasShellAccessToken } from '../api/moabomShellAccess';
import { useMoabomShellT } from '../i18n/MoabomUiI18nProvider';
import {
  MOABOM_PRESENCE_SETTINGS_OPTIMISTIC_EVENT,
  type PresenceSettingsOptimisticDetail,
} from '../components/composite/mypage/tabs/useMyPagePresenceSettings';
import {
  resolveShellPresenceActivityText,
} from '../shell/moaShellPresenceActivity';
import { deferShellSecondaryWork } from '../shell/moaShellDeferredWork';
import { whenMoabomBootPhaseAtLeast } from '../runtime/moabomShellBootPipeline';
import { runMoabomShellRealtimeTask } from '../runtime/moabomShellRealtimeRequestCoalescer';
import { resolveClientFormFactor } from '../utils/clientFormFactor';
import {
  normalizePresenceConnectList,
  rememberPresenceSessionKey,
  rememberSelfGuestIpFromConnectList,
  shouldRefreshConnectListAfterHeartbeat,
} from '../shell/presenceConnectSync';
import {
  applyOptimisticLoginToOnlineUsers,
  applyOptimisticLogoutToOnlineUsers,
} from '../shell/presenceLoginBridge';
import { getOrCreateShellVisitorId } from '../shell/ShellContextBridge';
import {
  consumeMoabomPresenceFriendsStale,
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

export interface MoabomPresenceSummarySlice {
  summary: PresenceSummary | null;
}

export interface MoabomPresenceOnlineSlice {
  onlineUsers: PresenceOnlineUser[];
  ownPresence: OwnPresenceState | null;
  loadingOnline: boolean;
  refreshOnline: () => Promise<void>;
}

export interface MoabomPresenceFriendsSlice {
  friends: PresenceFriend[];
  loadingFriends: boolean;
  refreshFriends: () => Promise<void>;
  addFriend: (userUuid: string) => Promise<void>;
  acceptFriend: (userUuid: string) => Promise<void>;
  removeFriend: (userUuid: string) => Promise<void>;
}

export interface MoabomPresenceSettingsSlice {
  presenceSettings: PresenceSettings | null;
  presenceSettingsHydrated: boolean;
  presenceSettingsLoading: boolean;
  applyPresenceSettingsSnapshot: (settings: PresenceSettings) => void;
}

const MoabomPresenceSummaryContext = createContext<MoabomPresenceSummarySlice | null>(null);
const MoabomPresenceOnlineContext = createContext<MoabomPresenceOnlineSlice | null>(null);
const MoabomPresenceFriendsContext = createContext<MoabomPresenceFriendsSlice | null>(null);
const MoabomPresenceSettingsContext = createContext<MoabomPresenceSettingsSlice | null>(null);

export interface MoabomPresenceProviderProps {
  isLoggedIn: boolean;
  children: React.ReactNode;
}

/**
 * 우측 접속자/친구 탭 활성 — 무거운 목록 refetch·주기 heartbeat 전용.
 * revision WS 구독은 로그인 유지(가벼운 수신)와 분리한다.
 */
export type MoabomPresenceSurface = 'connect' | 'friend' | null;

const MoabomPresenceSurfaceActiveContext = createContext<{
  presenceSurface: MoabomPresenceSurface;
  setPresenceSurface: (surface: MoabomPresenceSurface) => void;
} | null>(null);

/**
 * 셸 SSOT — auth/WS coordinator·세션 touch.
 * 로그인 후: revision/알림 WS 구독 유지.
 * 탭 활성 시만: 목록 refetch·주기 heartbeat.
 */
export function MoabomPresenceProvider({ isLoggedIn, children }: MoabomPresenceProviderProps) {
  const { t } = useMoabomShellT();
  // member store 구독으로 로그인 유지 상태의 A→B 토큰 전환도 Provider를 다시 평가한다.
  useShellAuthStateKey();
  const [summary, setSummary] = useState<PresenceSummary | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<PresenceOnlineUser[]>([]);
  const [friends, setFriends] = useState<PresenceFriend[]>([]);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [onlineListHydratedScopeKey, setOnlineListHydratedScopeKey] = useState<string | null>(null);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [ownPresence, setOwnPresence] = useState<OwnPresenceState | null>(null);
  const [presenceSettings, setPresenceSettings] = useState<PresenceSettings | null>(null);
  const [presenceSettingsHydrated, setPresenceSettingsHydrated] = useState(false);
  const [presenceSettingsLoading, setPresenceSettingsLoading] = useState(false);
  const [presenceSurface, setPresenceSurface] = useState<MoabomPresenceSurface>(null);
  const presenceSurfaceActive = presenceSurface !== null;

  const ownPresenceRef = useRef<OwnPresenceState | null>(null);
  const settingsHydratedRef = useRef(false);
  /** 로그인 직후 presence 채널 재구독 트리거 (WebSocket auth 동기화) */
  const [wsAuthEpoch, setWsAuthEpoch] = useState(0);
  // boolean 로그인 여부가 아니라 실제 access scope를 경계로 사용자 상태를 폐기한다.
  const authScopeRef = useRef('guest');
  const selfUserUuidRef = useRef<string | null>(getShellAuthUserUuid());
  const sessionBootstrappedRef = useRef(false);
  /** 저장 완료 전 heartbeat·API 재조회가 낙관적 설정을 덮어쓰지 않도록 보호 */
  const localPendingSettingsRef = useRef<LocalPendingPresenceSettings | null>(null);
  const heartbeatDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceSurfaceActiveRef = useRef(false);
  const presenceSurfaceRef = useRef<MoabomPresenceSurface>(null);
  const loginHeartbeatPromiseRef = useRef<Promise<void> | null>(null);
  const onlineRequestGenerationRef = useRef(0);
  const friendsRequestGenerationRef = useRef(0);
  const settingsRequestGenerationRef = useRef(0);
  const membershipSubscriptionRef = useRef<PresenceSocketSubscription | null>(null);
  const memberLeaveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const presenceMemberUuidsRef = useRef(new Set<string>());

  useEffect(() => {
    presenceSurfaceActiveRef.current = presenceSurfaceActive;
    presenceSurfaceRef.current = presenceSurface;
  }, [presenceSurface, presenceSurfaceActive]);

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

  const applyPresenceMember = useCallback((
    member: PresenceMember,
    online: boolean,
    adjustSummary = false,
  ) => {
    const userUuid = member.uuid?.trim();
    if (!userUuid) {
      return;
    }
    const wasPresent = presenceMemberUuidsRef.current.has(userUuid);
    const existingTimer = memberLeaveTimersRef.current[userUuid];
    if (online) {
      presenceMemberUuidsRef.current.add(userUuid);
      if (adjustSummary && !wasPresent && !existingTimer) {
        setSummary(prev => prev ? { ...prev, tenant_active: prev.tenant_active + 1 } : prev);
      }
    } else {
      presenceMemberUuidsRef.current.delete(userUuid);
    }

    if (existingTimer) {
      clearTimeout(existingTimer);
      delete memberLeaveTimersRef.current[userUuid];
    }

    const applyOnline = () => {
      setOnlineUsers(prev => {
        const existing = prev.find(row => row.user_uuid === userUuid);
        if (!existing && !online) {
          return prev;
        }
        if (!existing) {
          return [...prev, {
            session_key: `ws:${userUuid}`,
            user_uuid: userUuid,
            display_name: member.name?.trim() || '',
            avatar: member.avatar ?? null,
            is_authenticated: true,
            is_online: true,
            friendship: 'none',
            last_seen_at: new Date().toISOString(),
          }];
        }
        return prev.map(row => row.user_uuid === userUuid
          ? {
            ...row,
            display_name: member.name?.trim() || row.display_name,
            avatar: member.avatar ?? row.avatar,
            is_online: online,
            last_seen_at: online ? new Date().toISOString() : row.last_seen_at,
          }
          : row);
      });
      setFriends(prev => prev.map(friend => (
        friend.user_uuid === userUuid ? { ...friend, is_online: online } : friend
      )));
    };

    if (online) {
      applyOnline();
      return;
    }

    memberLeaveTimersRef.current[userUuid] = setTimeout(() => {
      delete memberLeaveTimersRef.current[userUuid];
      applyOnline();
      if (adjustSummary && wasPresent) {
        setSummary(prev => prev
          ? { ...prev, tenant_active: Math.max(0, prev.tenant_active - 1) }
          : prev);
      }
    }, 180_000);
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
      const next = await runMoabomShellRealtimeTask(
        'presence:summary',
        () => fetchPresenceSummary(),
        { minIntervalMs: 500 },
      );
      noteShellPresenceRevision(next.revision);
      setSummary(next);
    } catch {
      setSummary(null);
    }
  }, []);

  const refreshOnline = useCallback(async () => {
    const requestGeneration = ++onlineRequestGenerationRef.current;
    const accessScopeKey = getShellAccessScopeKey();
    setLoadingOnline(true);
    try {
      const payload = await runMoabomShellRealtimeTask(
        `presence:online:${accessScopeKey}`,
        () => fetchPresenceOnlineUsers(),
        { minIntervalMs: 500 },
      );
      if (
        requestGeneration !== onlineRequestGenerationRef.current
        || accessScopeKey !== getShellAccessScopeKey()
      ) {
        return;
      }
      noteShellPresenceRevision(payload.revision);
      rememberSelfGuestIpFromConnectList(payload.users, getOrCreateShellVisitorId());
      setOnlineUsers(applyPendingSelfPresenceToOnlineUsers(
        normalizePresenceConnectList(payload.users, getShellAuthUserUuid()),
        getShellAuthUserUuid(),
        ownPresenceRef.current,
        localPendingSettingsRef.current,
      ));
    } catch {
      if (requestGeneration === onlineRequestGenerationRef.current) {
        setOnlineUsers([]);
      }
    } finally {
      if (requestGeneration === onlineRequestGenerationRef.current) {
        setOnlineListHydratedScopeKey(accessScopeKey);
        setLoadingOnline(false);
      }
    }
  }, []);

  const refreshFriends = useCallback(async () => {
    if (!isLoggedIn) {
      setFriends([]);
      return;
    }
    const requestGeneration = ++friendsRequestGenerationRef.current;
    const accessScopeKey = getShellAccessScopeKey();
    setLoadingFriends(true);
    try {
      const rows = await runMoabomShellRealtimeTask(
        `presence:friends:${accessScopeKey}`,
        () => fetchPresenceFriends(),
        { minIntervalMs: 500 },
      );
      if (
        requestGeneration !== friendsRequestGenerationRef.current
        || accessScopeKey !== getShellAccessScopeKey()
      ) {
        return;
      }
      setFriends(applyPendingSelfPresenceToFriends(
        rows,
        getShellAuthUserUuid(),
        ownPresenceRef.current,
        localPendingSettingsRef.current,
      ));
    } catch {
      if (requestGeneration === friendsRequestGenerationRef.current) {
        setFriends([]);
      }
    } finally {
      if (requestGeneration === friendsRequestGenerationRef.current) {
        setLoadingFriends(false);
      }
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
    const requestGeneration = ++settingsRequestGenerationRef.current;
    const accessScopeKey = getShellAccessScopeKey();
    setPresenceSettingsLoading(true);
    try {
      const settings = await fetchPresenceSettings();
      if (
        requestGeneration !== settingsRequestGenerationRef.current
        || accessScopeKey !== getShellAccessScopeKey()
      ) {
        if (requestGeneration === settingsRequestGenerationRef.current) {
          setPresenceSettingsLoading(false);
        }
        return null;
      }
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
      if (requestGeneration === settingsRequestGenerationRef.current) {
        setPresenceSettingsLoading(false);
      }
      return ownPresenceRef.current?.subtitle_mode ?? null;
    }
  }, [applyOwnPresencePatch, applyPresenceSettingsSnapshot, isLoggedIn, t]);

  const runHeartbeat = useCallback(async (options?: {
    skipSummaryRefresh?: boolean;
    refreshConnectList?: boolean;
    hydrateSettings?: boolean;
    touch?: PresenceHeartbeatTouch;
  }) => {
    try {
      let subtitleMode: PresenceSubtitleMode | null | undefined = ownPresenceRef.current?.subtitle_mode;
      if (
        isLoggedIn
        && !settingsHydratedRef.current
        && options?.hydrateSettings !== false
      ) {
        subtitleMode = await hydrateOwnSettings();
      }
      const statusText = subtitleMode === 'activity'
        ? resolveShellPresenceActivityText(t)
        : null;
      const heartbeat = await sendPresenceHeartbeat(
        statusText,
        resolveClientFormFactor(),
        options?.touch,
        {
          wsState: isMoabomWebSocketConnected() ? 'connected' : 'disconnected',
          visibilityState: document.visibilityState === 'visible' ? 'visible' : 'hidden',
        },
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
      // summary는 revision push 또는 WS 장애 fallback에서만 갱신한다.
      if (options?.skipSummaryRefresh === false) {
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
    if (!isMoabomWebSocketConnected()) {
      await Promise.all([refreshOnline(), refreshFriends()]);
    }
  }, [refreshFriends, refreshOnline, runHeartbeat]);

  useEffect(() => {
    if (sessionBootstrappedRef.current) {
      return;
    }
    sessionBootstrappedRef.current = true;
    // idle: summary·목록 선로드 없음 — 탭 진입·로그인 touch 시에만
  }, []);

  useEffect(() => () => {
    if (heartbeatDebounceRef.current !== null) {
      clearTimeout(heartbeatDebounceRef.current);
      heartbeatDebounceRef.current = null;
    }
    Object.values(memberLeaveTimersRef.current).forEach(timer => clearTimeout(timer));
    memberLeaveTimersRef.current = {};
    presenceMemberUuidsRef.current.clear();
    membershipSubscriptionRef.current?.leave();
    membershipSubscriptionRef.current = null;
  }, []);

  useEffect(() => {
    const authScopeKey = isLoggedIn ? getShellAccessScopeKey() : 'guest';
    if (authScopeRef.current === authScopeKey) {
      return;
    }
    authScopeRef.current = authScopeKey;

    settingsRequestGenerationRef.current += 1;
    onlineRequestGenerationRef.current += 1;
    friendsRequestGenerationRef.current += 1;
    settingsHydratedRef.current = false;
    localPendingSettingsRef.current = null;
    setPresenceSettings(null);
    setPresenceSettingsHydrated(false);
    setPresenceSettingsLoading(false);
    ownPresenceRef.current = null;
    setOwnPresence(null);
    setOnlineListHydratedScopeKey(null);
    setLoadingOnline(false);
    setLoadingFriends(false);

    if (isLoggedIn) {
      selfUserUuidRef.current = getShellAuthUserUuid();
      // 즉시 UI: AuthManager uuid 가 있으면 guest→회원 1행으로 교체(서버 확정 전 낙관적).
      setOnlineUsers(prev => applyOptimisticLoginToOnlineUsers(prev, ownPresenceRef.current));
      setFriends([]);
      const loginHeartbeatPromise = new Promise<void>(resolve => {
        deferShellSecondaryWork(async () => {
          // 로그인 세션 확정은 이 경로가 단독 소유하고, 목록은 active-tab effect가 뒤이어 1회 조회한다.
          await runHeartbeat({
            touch: 'login',
            skipSummaryRefresh: true,
            refreshConnectList: false,
            // 서버 heartbeat가 사용자 설정을 직접 읽는다. 별도 settings API를 목록 앞에서 기다리지 않는다.
            hydrateSettings: false,
          });
          resolve();
        }, 0);
      });
      loginHeartbeatPromiseRef.current = loginHeartbeatPromise;
      return;
    }

    loginHeartbeatPromiseRef.current = null;
    const loggedOutUuid = selfUserUuidRef.current;
    if (loggedOutUuid) {
      setOnlineUsers(prev => applyOptimisticLogoutToOnlineUsers(prev, loggedOutUuid));
    }
    selfUserUuidRef.current = null;
    void runHeartbeat({ touch: 'logout', refreshConnectList: true });
  }, [
    isLoggedIn,
    runHeartbeat,
  ]);

  useEffect(() => {
    installMoabomShellRealtimeCoordinator();
    installShellChatInboxCacheBridge();
    installShellNotificationBridge();
    installMoabomShellChatBackgroundNotify();
    installMoabomFcmServiceWorkerBridge();
    installMoabomShellRealtimeSessionTokenListener();
  }, []);

  useEffect(() => {
    const onRealtimeState = (event: Event) => {
      const detail = (event as CustomEvent<MoabomRealtimeState>).detail;
      const presence = detail?.presence as {
        summary?: PresenceSummary;
        friends?: PresenceFriend[];
        online?: PresenceOnlinePayload;
      } | undefined;
      if (!presence) {
        return;
      }
      if (presence.summary) {
        noteShellPresenceRevision(presence.summary.revision);
        setSummary(presence.summary);
      }
      if (Array.isArray(presence.friends)) {
        setFriends(presence.friends);
      }
      if (Array.isArray(presence.online?.users)) {
        noteShellPresenceRevision(presence.online.revision);
        rememberSelfGuestIpFromConnectList(presence.online.users, getOrCreateShellVisitorId());
        setOnlineUsers(normalizePresenceConnectList(
          presence.online.users,
          getShellAuthUserUuid(),
        ));
        setOnlineListHydratedScopeKey(getShellAccessScopeKey());
      }
    };
    window.addEventListener(MOABOM_REALTIME_STATE_SYNCED_EVENT, onRealtimeState);
    return () => window.removeEventListener(MOABOM_REALTIME_STATE_SYNCED_EVENT, onRealtimeState);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      bindMoabomShellRealtimeSession({ wanted: false });
      return;
    }

    const cancelRealtime = whenMoabomBootPhaseAtLeast('secondary', () => {
      // WS auth + 알림/인박스 — uuid 미준비면 teardown 없이 짧게 재시도
      syncMoabomWebSocketAuth(true);
      bindMoabomShellRealtimeSession({
        wanted: true,
        uuid: getShellAuthUserUuid(),
      });
    });
    const cancelFcm = whenMoabomBootPhaseAtLeast('tertiary-idle', () => {
      void registerMoabomFcmDeviceToken();
    });

    return () => {
      cancelRealtime();
      cancelFcm();
      bindMoabomShellRealtimeSession({ wanted: false });
    };
  }, [isLoggedIn]);

  useEffect(() => {
    const onWsAuthSynced = () => {
      setWsAuthEpoch(epoch => epoch + 1);
      if (!isLoggedIn && !hasShellAccessToken()) {
        return;
      }
      bindMoabomShellRealtimeSession({
        wanted: Boolean(isLoggedIn || hasShellAccessToken()),
        uuid: getShellAuthUserUuid(),
      });
    };
    window.addEventListener(MOABOM_WEBSOCKET_AUTH_SYNCED_EVENT, onWsAuthSynced);
    return () => {
      window.removeEventListener(MOABOM_WEBSOCKET_AUTH_SYNCED_EVENT, onWsAuthSynced);
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      void runHeartbeat({ touch: 'touch', refreshConnectList: false });
    };
    const timer = window.setInterval(tick, 120_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void runHeartbeat({ touch: 'touch', refreshConnectList: false });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isLoggedIn, runHeartbeat]);

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }
    // login touch·visibility 와 겹치는 즉시 중복 방지 — 1.5s debounce
    return subscribeMoabomWebSocketConnectionChange(() => {
      scheduleDebouncedHeartbeat({ touch: 'touch', refreshConnectList: false });
    });
  }, [isLoggedIn, scheduleDebouncedHeartbeat]);

  const invalidatePresenceFromRevision = useCallback((targets: PresenceRefetchTargets) => {
    // 정상 WS에서는 presence membership·도메인 delta가 SSOT입니다.
    // revision은 구형 이벤트 호환과 장애 상태에서만 REST 복구 신호로 사용합니다.
    if (!presenceSurfaceActiveRef.current || isMoabomWebSocketConnected()) {
      return;
    }
    const tasks: Promise<void>[] = [];
    if (targets.summary) {
      tasks.push(refreshSummary());
    }
    if (targets.online) {
      tasks.push(refreshOnline());
    }
    if (targets.friends) {
      tasks.push(refreshFriends());
    }
    if (tasks.length > 0) {
      void Promise.all(tasks);
    }
  }, [refreshFriends, refreshOnline, refreshSummary]);

  useEffect(() => registerShellPresenceInvalidate(invalidatePresenceFromRevision), [
    invalidatePresenceFromRevision,
  ]);

  useEffect(() => {
    if (!presenceSurfaceActive) {
      return;
    }
    return registerShellPlatformSummaryInvalidate(refreshSummary);
  }, [presenceSurfaceActive, refreshSummary]);

  /** 로그아웃 시 인증 세션의 summary/channel 스냅샷을 폐기한다. */
  useEffect(() => {
    if (!isLoggedIn) {
      setSummary(null);
    }
  }, [isLoggedIn]);

  const revisionSubscriptionKeyRef = useRef<string | null>(null);
  const platformRevisionSubscriptionKeyRef = useRef<string | null>(null);
  const friendsSubscriptionKeyRef = useRef<string | null>(null);
  const memberStateSubscriptionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    membershipSubscriptionRef.current?.leave();
    membershipSubscriptionRef.current = null;

    if (
      !isLoggedIn
      || !presenceSurfaceActive
      || !summary?.presence_channel
      || !isMoabomWebSocketConnected()
    ) {
      return;
    }

    const subscription = subscribeTenantPresenceChannel(summary.presence_channel, {
      onHere: members => {
        presenceMemberUuidsRef.current = new Set(
          members.map(member => member.uuid?.trim()).filter((uuid): uuid is string => Boolean(uuid)),
        );
        members.forEach(member => applyPresenceMember(member, true));
      },
      onJoining: member => applyPresenceMember(member, true, true),
      onLeaving: member => applyPresenceMember(member, false, true),
    });
    membershipSubscriptionRef.current = subscription;

    return () => {
      if (membershipSubscriptionRef.current === subscription) {
        membershipSubscriptionRef.current?.leave();
        membershipSubscriptionRef.current = null;
      }
    };
  }, [
    applyPresenceMember,
    isLoggedIn,
    presenceSurfaceActive,
    summary?.presence_channel,
    wsAuthEpoch,
  ]);

  useEffect(() => {
    if (memberStateSubscriptionKeyRef.current) {
      unsubscribePresenceRevisionChannel(memberStateSubscriptionKeyRef.current);
      memberStateSubscriptionKeyRef.current = null;
    }
    if (!isLoggedIn || !presenceSurfaceActive || !summary?.presence_channel) {
      return;
    }
    const key = subscribePresenceMemberStateChannel(summary.presence_channel, payload => {
      const userUuid = payload.user_uuid?.trim();
      if (!userUuid) {
        return;
      }
      setOnlineUsers(prev => prev.map(row => (
        row.user_uuid === userUuid
          ? {
            ...row,
            display_name: payload.display_name ?? row.display_name,
            avatar: payload.avatar !== undefined ? payload.avatar : row.avatar,
            availability: payload.availability ?? row.availability,
            presence_subtitle: payload.presence_subtitle !== undefined
              ? payload.presence_subtitle
              : row.presence_subtitle,
            status_text: payload.presence_subtitle !== undefined
              ? payload.presence_subtitle
              : row.status_text,
            is_online: payload.is_reachable ?? row.is_online,
          }
          : row
      )));
      setFriends(prev => prev.map(friend => (
        friend.user_uuid === userUuid
          ? {
            ...friend,
            display_name: payload.display_name ?? friend.display_name,
            avatar: payload.avatar !== undefined ? payload.avatar : friend.avatar,
            availability: payload.availability ?? friend.availability,
            presence_subtitle: payload.presence_subtitle !== undefined
              ? payload.presence_subtitle
              : friend.presence_subtitle,
            status_text: payload.presence_subtitle !== undefined
              ? payload.presence_subtitle
              : friend.status_text,
            is_online: payload.is_reachable ?? friend.is_online,
          }
          : friend
      )));
    });
    memberStateSubscriptionKeyRef.current = key;

    return () => {
      if (memberStateSubscriptionKeyRef.current === key && key) {
        unsubscribePresenceRevisionChannel(key);
        memberStateSubscriptionKeyRef.current = null;
      }
    };
  }, [isLoggedIn, presenceSurfaceActive, summary?.presence_channel, wsAuthEpoch]);

  useEffect(() => {
    if (friendsSubscriptionKeyRef.current) {
      unsubscribePresenceRevisionChannel(friendsSubscriptionKeyRef.current);
      friendsSubscriptionKeyRef.current = null;
    }
    const userUuid = isLoggedIn && presenceSurfaceActive ? getShellAuthUserUuid() : null;
    if (!userUuid) {
      return;
    }
    const key = subscribePresenceFriendsChannel(userUuid, payload => {
      if (!Array.isArray(payload.friends)) {
        return;
      }
      const nextFriends = applyPendingSelfPresenceToFriends(
        payload.friends,
        getShellAuthUserUuid(),
        ownPresenceRef.current,
        localPendingSettingsRef.current,
      );
      const accepted = new Set(nextFriends.map(friend => friend.user_uuid));
      setFriends(nextFriends);
      setOnlineUsers(prev => prev.map(row => {
        if (!row.user_uuid) {
          return row;
        }
        if (accepted.has(row.user_uuid)) {
          return { ...row, friendship: 'accepted' };
        }
        return row.friendship === 'accepted' ? { ...row, friendship: 'none' } : row;
      }));
    });
    friendsSubscriptionKeyRef.current = key;

    return () => {
      if (friendsSubscriptionKeyRef.current === key && key) {
        unsubscribePresenceRevisionChannel(key);
        friendsSubscriptionKeyRef.current = null;
      }
    };
  }, [isLoggedIn, presenceSurfaceActive, wsAuthEpoch]);

  useEffect(() => {
    if (!isLoggedIn || !presenceSurfaceActive || !summary?.revision_channel) {
      if (revisionSubscriptionKeyRef.current) {
        unsubscribePresenceRevisionChannel(revisionSubscriptionKeyRef.current);
        revisionSubscriptionKeyRef.current = null;
      }
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
  }, [isLoggedIn, presenceSurfaceActive, summary?.revision_channel, wsAuthEpoch]);

  useEffect(() => {
    if (!isLoggedIn || !presenceSurfaceActive || !summary?.platform_revision_channel) {
      if (platformRevisionSubscriptionKeyRef.current) {
        unsubscribePresenceRevisionChannel(platformRevisionSubscriptionKeyRef.current);
        platformRevisionSubscriptionKeyRef.current = null;
      }
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
  }, [isLoggedIn, presenceSurfaceActive, summary?.platform_revision_channel, wsAuthEpoch]);

  useEffect(() => {
    if (!presenceSurface) {
      return;
    }

    const target = presenceSurface;
    // 활성 탭의 목록만 busy 처리한다. 숨겨진 탭의 API·spinner는 함께 시작하지 않는다.
    if (target === 'connect') {
      setLoadingOnline(true);
      setLoadingFriends(false);
    } else {
      setLoadingOnline(false);
      setLoadingFriends(true);
    }

    let cancelled = false;
    const cancelBoot = whenMoabomBootPhaseAtLeast('tertiary-idle', () => {
      if (cancelled || presenceSurfaceRef.current !== target) {
        return;
      }
      void (async () => {
        if (isLoggedIn) {
          await loginHeartbeatPromiseRef.current;
        }
        if (cancelled || presenceSurfaceRef.current !== target) {
          return;
        }

        if (target === 'connect') {
          await refreshOnline();
          if (isLoggedIn && !cancelled && presenceSurfaceRef.current === target) {
            void refreshSummary();
          }
          return;
        }

        if (isLoggedIn) {
          // 탭 OFF 동안 friend_accepted 등이 쌓였으면 stale 소비 후 친구 목록만 확정한다.
          consumeMoabomPresenceFriendsStale();
          await refreshFriends();
          if (!cancelled && presenceSurfaceRef.current === target) {
            void refreshSummary();
          }
        }
      })();
    });

    return () => {
      cancelled = true;
      cancelBoot();
      if (target === 'connect') {
        setLoadingOnline(false);
      } else {
        setLoadingFriends(false);
      }
    };
  }, [
    isLoggedIn,
    presenceSurface,
    refreshFriends,
    refreshOnline,
    refreshSummary,
  ]);

  useEffect(() => {
    return subscribeMoabomPresenceFriendsChanged(() => {
      // 탭 OFF: stale 플래그만(notify 가 mark). 탭 ON: friends REST 1회 — WS 연결이어도 수락 즉시 정합
      if (!presenceSurfaceActiveRef.current) {
        return;
      }
      void refreshFriends();
    });
  }, [refreshFriends]);

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
      if (!presenceSurfaceActiveRef.current) {
        return;
      }
      if (ownPresenceRef.current?.subtitle_mode === 'activity') {
        scheduleDebouncedHeartbeat({ refreshConnectList: !isMoabomWebSocketConnected() });
      }
    };
    const handlePathChanged = () => {
      applyActivitySubtitleLocally();
      if (!presenceSurfaceActiveRef.current) {
        return;
      }
      if (ownPresenceRef.current?.subtitle_mode === 'activity') {
        scheduleDebouncedHeartbeat({ refreshConnectList: !isMoabomWebSocketConnected() });
      }
    };
    // visibility→touch 는 위 120s lease effect 가 SSOT (여기 중복 등록 금지)
    const handleWindowFocus = () => {
      if (!presenceSurfaceActiveRef.current) {
        return;
      }
      scheduleDebouncedHeartbeat({ refreshConnectList: !isMoabomWebSocketConnected() });
    };

    window.addEventListener('moabom-presence-settings-changed', handleSettingsChanged);
    window.addEventListener(MOABOM_PRESENCE_SETTINGS_OPTIMISTIC_EVENT, handleOptimistic);
    window.addEventListener('moabom-shell-presence-context-changed', handlePresenceContextChanged);
    window.addEventListener('moabom-shell-path-changed', handlePathChanged);
    window.addEventListener('popstate', handlePathChanged);
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('moabom-presence-settings-changed', handleSettingsChanged);
      window.removeEventListener(MOABOM_PRESENCE_SETTINGS_OPTIMISTIC_EVENT, handleOptimistic);
      window.removeEventListener('moabom-shell-presence-context-changed', handlePresenceContextChanged);
      window.removeEventListener('moabom-shell-path-changed', handlePathChanged);
      window.removeEventListener('popstate', handlePathChanged);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [applyActivitySubtitleLocally, applyPresenceSettingsOptimistic, confirmPresenceSettingsOnServer, scheduleDebouncedHeartbeat]);

  const addFriend = useCallback(async (userUuid: string) => {
    await requestPresenceFriend(userUuid);
    notifyMoabomPresenceFriendsChanged();
    if (!isMoabomWebSocketConnected()) {
      await Promise.all([refreshOnline(), refreshFriends()]);
    }
  }, [refreshFriends, refreshOnline]);

  const acceptFriend = useCallback(async (userUuid: string) => {
    await acceptPresenceFriend(userUuid);
    notifyMoabomPresenceFriendsChanged();
    if (!isMoabomWebSocketConnected()) {
      await Promise.all([refreshOnline(), refreshFriends()]);
    }
  }, [refreshFriends, refreshOnline]);

  const removeFriend = useCallback(async (userUuid: string) => {
    setFriends(prev => prev.filter(friend => friend.user_uuid !== userUuid));
    await removePresenceFriend(userUuid);
    notifyMoabomPresenceFriendsChanged();
    if (!isMoabomWebSocketConnected()) {
      await Promise.all([refreshOnline(), refreshFriends()]);
    }
  }, [refreshFriends, refreshOnline]);

  const summaryValue = useMemo<MoabomPresenceSummarySlice>(() => ({
    summary,
  }), [summary]);

  const onlineListScopeReady = !isLoggedIn
    || onlineListHydratedScopeKey === getShellAccessScopeKey();
  const onlineValue = useMemo<MoabomPresenceOnlineSlice>(() => ({
    onlineUsers: onlineListScopeReady ? onlineUsers : [],
    ownPresence,
    loadingOnline: loadingOnline || !onlineListScopeReady,
    refreshOnline,
  }), [
    loadingOnline,
    onlineListScopeReady,
    onlineUsers,
    ownPresence,
    refreshOnline,
  ]);

  const friendsValue = useMemo<MoabomPresenceFriendsSlice>(() => ({
    friends,
    loadingFriends,
    refreshFriends,
    addFriend,
    acceptFriend,
    removeFriend,
  }), [
    acceptFriend,
    addFriend,
    friends,
    loadingFriends,
    refreshFriends,
    removeFriend,
  ]);

  const settingsValue = useMemo<MoabomPresenceSettingsSlice>(() => ({
    presenceSettings,
    presenceSettingsHydrated,
    presenceSettingsLoading,
    applyPresenceSettingsSnapshot,
  }), [
    applyPresenceSettingsSnapshot,
    presenceSettings,
    presenceSettingsHydrated,
    presenceSettingsLoading,
  ]);

  const surfaceValue = useMemo(() => ({
    presenceSurface,
    setPresenceSurface,
  }), [presenceSurface]);

  return (
    <MoabomPresenceSurfaceActiveContext.Provider value={surfaceValue}>
      <MoabomPresenceSummaryContext.Provider value={summaryValue}>
        <MoabomPresenceOnlineContext.Provider value={onlineValue}>
          <MoabomPresenceFriendsContext.Provider value={friendsValue}>
            <MoabomPresenceSettingsContext.Provider value={settingsValue}>
              {children}
            </MoabomPresenceSettingsContext.Provider>
          </MoabomPresenceFriendsContext.Provider>
        </MoabomPresenceOnlineContext.Provider>
      </MoabomPresenceSummaryContext.Provider>
    </MoabomPresenceSurfaceActiveContext.Provider>
  );
}

export function useMoabomPresenceSurfaceActive(): {
  presenceSurface: MoabomPresenceSurface;
  setPresenceSurface: (surface: MoabomPresenceSurface) => void;
} {
  const ctx = useContext(MoabomPresenceSurfaceActiveContext);
  if (!ctx) {
    throw new Error('useMoabomPresenceSurfaceActive must be used within MoabomPresenceProvider');
  }
  return ctx;
}

export function useMoabomPresenceSummary(): MoabomPresenceSummarySlice {
  const ctx = useContext(MoabomPresenceSummaryContext);
  if (!ctx) {
    throw new Error('useMoabomPresenceSummary must be used within MoabomPresenceProvider');
  }
  return ctx;
}

export function useMoabomPresenceOnline(): MoabomPresenceOnlineSlice {
  const ctx = useContext(MoabomPresenceOnlineContext);
  if (!ctx) {
    throw new Error('useMoabomPresenceOnline must be used within MoabomPresenceProvider');
  }
  return ctx;
}

export function useMoabomPresenceFriends(): MoabomPresenceFriendsSlice {
  const ctx = useContext(MoabomPresenceFriendsContext);
  if (!ctx) {
    throw new Error('useMoabomPresenceFriends must be used within MoabomPresenceProvider');
  }
  return ctx;
}

export function useMoabomPresenceSettings(): MoabomPresenceSettingsSlice {
  const ctx = useContext(MoabomPresenceSettingsContext);
  if (!ctx) {
    throw new Error('useMoabomPresenceSettings must be used within MoabomPresenceProvider');
  }
  return ctx;
}

export function useMoabomPresenceSummaryOptional(): MoabomPresenceSummarySlice | null {
  return useContext(MoabomPresenceSummaryContext);
}

export function useMoabomPresenceOnlineOptional(): MoabomPresenceOnlineSlice | null {
  return useContext(MoabomPresenceOnlineContext);
}

export function useMoabomPresenceFriendsOptional(): MoabomPresenceFriendsSlice | null {
  return useContext(MoabomPresenceFriendsContext);
}

export function useMoabomPresenceSettingsOptional(): MoabomPresenceSettingsSlice | null {
  return useContext(MoabomPresenceSettingsContext);
}

export function useMoabomPresenceContext(): MoabomPresenceContextValue {
  const summarySlice = useMoabomPresenceSummary();
  const onlineSlice = useMoabomPresenceOnline();
  const friendsSlice = useMoabomPresenceFriends();
  const settingsSlice = useMoabomPresenceSettings();

  return useMemo<MoabomPresenceContextValue>(() => ({
    summary: summarySlice.summary,
    onlineUsers: onlineSlice.onlineUsers,
    friends: friendsSlice.friends,
    ownPresence: onlineSlice.ownPresence,
    presenceSettings: settingsSlice.presenceSettings,
    presenceSettingsHydrated: settingsSlice.presenceSettingsHydrated,
    presenceSettingsLoading: settingsSlice.presenceSettingsLoading,
    applyPresenceSettingsSnapshot: settingsSlice.applyPresenceSettingsSnapshot,
    loadingOnline: onlineSlice.loadingOnline,
    loadingFriends: friendsSlice.loadingFriends,
    refreshOnline: onlineSlice.refreshOnline,
    refreshFriends: friendsSlice.refreshFriends,
    addFriend: friendsSlice.addFriend,
    acceptFriend: friendsSlice.acceptFriend,
    removeFriend: friendsSlice.removeFriend,
  }), [friendsSlice, onlineSlice, settingsSlice, summarySlice]);
}

export function useMoabomPresenceContextOptional(): MoabomPresenceContextValue | null {
  const summarySlice = useContext(MoabomPresenceSummaryContext);
  const onlineSlice = useContext(MoabomPresenceOnlineContext);
  const friendsSlice = useContext(MoabomPresenceFriendsContext);
  const settingsSlice = useContext(MoabomPresenceSettingsContext);

  if (!summarySlice || !onlineSlice || !friendsSlice || !settingsSlice) {
    return null;
  }

  return {
    summary: summarySlice.summary,
    onlineUsers: onlineSlice.onlineUsers,
    friends: friendsSlice.friends,
    ownPresence: onlineSlice.ownPresence,
    presenceSettings: settingsSlice.presenceSettings,
    presenceSettingsHydrated: settingsSlice.presenceSettingsHydrated,
    presenceSettingsLoading: settingsSlice.presenceSettingsLoading,
    applyPresenceSettingsSnapshot: settingsSlice.applyPresenceSettingsSnapshot,
    loadingOnline: onlineSlice.loadingOnline,
    loadingFriends: friendsSlice.loadingFriends,
    refreshOnline: onlineSlice.refreshOnline,
    refreshFriends: friendsSlice.refreshFriends,
    addFriend: friendsSlice.addFriend,
    acceptFriend: friendsSlice.acceptFriend,
    removeFriend: friendsSlice.removeFriend,
  };
}
