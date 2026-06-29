import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import { useMoaPanelScrollDrag } from '../../hooks/Moa_usePanelScrollDrag';
import { useDroppable } from '@dnd-kit/core';
import { Div } from '../basic/Div';
import { Button } from '../basic/Button';
import { Icon } from '../basic/Icon';
import { Img } from '../basic/Img';
import { Span } from '../basic/Span';
import { GlassPanel } from './Moa_GlassPanel';
import { Moa_PanelEmptyState } from './Moa_PanelEmptyState';
import { Moa_PanelLoadingState } from './Moa_PanelLoadingState';
import { Moa_OverflowMarqueeText } from './Moa_OverflowMarqueeText';
import { SubTabBar } from './Moa_SubTabBar';
import { LoginPrompt } from './Moa_LoginPrompt';
import { useMoabomPresence } from '../../hooks/useMoabomPresence';
import { useShellSubTabSelect, useShellSubTabSettle } from '../../hooks/useShellSubTabSelect';
import type { MyPageTab } from './Moa_MyPageWindowContent';
import type { AuthWindowMode } from './Moa_AuthWindowContent';
import { MOABOM_SHELL_SUB_TAB_SLOT_PX, MOABOM_SHELL_NOTIFICATION_PANEL_PAGE_SIZE } from '../../layout/moabomShellPanelLayout';
import { loadMoabomSystemState } from '../../utils/moabomSystemStore';
import { useMoabomShellNotifications } from '../../hooks/useMoabomShellNotifications';
import {
  formatNotificationRelativeTime,
  getNotificationVisual,
  resolveRelativeTimeLabel,
} from '../../utils/moabomNotificationPresentation';
import { isShellNotificationUnread } from '../../utils/moabomShellNotificationUtils';
import { MOA_HOME_EDGE, MOA_HOME_OVERLAY_EDGE } from '../../shell/moaShellLayoutConstants';
import type { ClientFormFactor } from '../../api/moabomPresenceApi';
import { presenceAvatarGrayscaleClass, presenceStatusDotClass } from '../../utils/presenceAvailability';
import { getShellAuthUserUuid, resolvePresenceListStatusLine, resolvePresenceListUserStatus } from '../../utils/presenceSettingsSync';
import { pushInfoToast, pushWarningToast } from '../../runtime/moaShellToasts';
import type { ShellSurfaceOpenAction, ShellUrlSyncOptions } from '../../shell/shellSurfaceTypes';
import { prefetchUserProfileWindowLayouts } from '../../shell/userProfileWindowPrefetch';
import { navigateMoabomChatConversation } from '../../utils/moabomChatNotificationNavigate';
import { Moa_RightPanelAdSlot } from './Moa_RightPanelAdSlot';

export interface RightPanelProps {
  /** 패널 너비 */
  width: number;
  /** 패널 오른쪽 오프셋 */
  rightOffset: number;
  /** 로그인 상태 */
  isLoggedIn: boolean;
  /** 현재 사용자 정보 */
  currentUser: { name: string; level: number; point: number; avatar?: string | null; is_admin?: boolean; is_super?: boolean } | null;
  /** 마이페이지 윈도우 열기 */
  onOpenMyPage?: (initialTab?: MyPageTab) => void;
  /** 인증 윈도우 열기 */
  onOpenAuth?: (mode: AuthWindowMode) => void;
  /** 셸 표면 열기 (SSOT) */
  onOpenShellSurface?: (action: ShellSurfaceOpenAction, sync?: ShellUrlSyncOptions) => void;
  /** @deprecated onOpenShellSurface 사용 */
  onOpenUserProfile?: (userUuid: string, displayName?: string, view?: 'profile' | 'posts') => void;
  /** 좁은 화면 오버레이 모드 여부 */
  isOverlay?: boolean;
  /**
   * 가장 좁은 구간(기본 480px 이하)에서만 true — 패널을 화면 끝에 붙이고 안쪽 모서리만 라운드.
   * 좌측 패널과 동일 기준(`isMobileOverlay`일 때만 부모에서 true 전달).
   */
  overlayFlushEdges?: boolean;
  /** 오버레이 닫기 핸들러 */
  onClose?: () => void;
}

/** 프로필 액션 버튼 정의 (라벨은 i18n 키) */
const PROFILE_ACTION_KEYS = [
  { icon: 'user-cog', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', labelKey: 'moa_shell.right.profile_action_profile' as const },
  { icon: 'cog', color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20', labelKey: 'moa_shell.right.profile_action_settings' as const },
  { icon: 'gem', color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-900/20', labelKey: 'moa_shell.right.profile_action_credit' as const },
  { icon: 'power-off', color: 'text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', labelKey: 'moa_shell.right.profile_action_logout' as const },
];

/** 우측 패널 탭 키 */
const RIGHT_TAB_KEYS = [
  { id: 'connect', labelKey: 'moa_shell.right.tab_connect' as const },
  { id: 'friend', labelKey: 'moa_shell.right.tab_friend' as const },
  { id: 'alarm', labelKey: 'moa_shell.right.tab_alarm' as const },
];

const PRESENCE_MENU_WIDTH_PX = 152;
const PRESENCE_ROW_ACTION_BUTTON_CLASS =
  'w-7 h-7 moa-btn moa-btn-dark-outline moa-btn-xs shrink-0';

interface PresenceUserActionsMenuProps {
  userUuid: string;
  displayName: string;
  friendship?: 'none' | 'outgoing_pending' | 'incoming_pending' | 'accepted';
  isLoggedIn: boolean;
  onOpenShellSurface?: (action: ShellSurfaceOpenAction) => void;
  onAddFriend: (userUuid: string) => void | Promise<void>;
  onAcceptFriend: (userUuid: string) => void | Promise<void>;
}

/** 친구 행 — 메시지 바로가기 */
const FriendChatOpenButton: React.FC<{ userUuid: string }> = ({ userUuid }) => {
  const { t } = useMoabomShellT();

  return (
    <Div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        className={PRESENCE_ROW_ACTION_BUTTON_CLASS}
        aria-label={t('moa_profile_actions.chat')}
        onClick={() => navigateMoabomChatConversation(userUuid)}
      >
        <Icon name="paper-plane" className="icon-muted text-sm" />
      </Button>
    </Div>
  );
};

/** 접속자 행 — 세로 … 메뉴 (Portal fixed — 패널 overflow 클리핑 회피) */
const PresenceUserActionsMenu: React.FC<PresenceUserActionsMenuProps> = ({
  userUuid,
  displayName,
  friendship,
  isLoggedIn,
  onOpenShellSurface,
  onAddFriend,
  onAcceptFriend,
}) => {
  const { t } = useMoabomShellT();
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPosition({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - PRESENCE_MENU_WIDTH_PX),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const handleReposition = () => updateMenuPosition();
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, updateMenuPosition]);

  const handleAddFriend = async () => {
    setOpen(false);
    try {
      await onAddFriend(userUuid);
    } catch {
      pushWarningToast(t('moa_shell.right.presence_friend_request_failed'));
    }
  };

  const handleAcceptFriend = async () => {
    setOpen(false);
    try {
      await onAcceptFriend(userUuid);
      pushInfoToast(t('moa_profile_actions.friend_became_toast', { name: displayName }), 3000);
    } catch {
      pushWarningToast(t('moa_shell.right.presence_friend_request_failed'));
    }
  };

  return (
    <Div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <Button
        ref={buttonRef}
        type="button"
        className={PRESENCE_ROW_ACTION_BUTTON_CLASS}
        aria-label={t('moa_shell.right.presence_menu')}
        aria-expanded={open}
        onClick={() => {
          if (!open) {
            updateMenuPosition();
            prefetchUserProfileWindowLayouts();
          }
          setOpen(prev => !prev);
        }}
      >
        <Icon name="ellipsis-v" className="icon-muted text-sm" />
      </Button>
      {open && createPortal(
        <Div
          ref={menuRef}
          className="fixed z-[9999] moa-presence-access-menu flex min-w-[9.5rem] flex-col gap-1 rounded-2xl glass-sm p-2 shadow-lg"
          style={{ top: menuPosition.top, left: menuPosition.left, width: PRESENCE_MENU_WIDTH_PX }}
        >
          <Button
            type="button"
            variant="primary-outline"
            size="sm"
            className="w-full"
            onClick={() => {
              setOpen(false);
              onOpenShellSurface?.({
                kind: 'profile',
                userUuid,
                displayName,
                view: 'profile',
              });
            }}
          >
            {t('moa_shell.right.presence_view_profile')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full border-0"
            onClick={() => {
              setOpen(false);
              onOpenShellSurface?.({
                kind: 'profile',
                userUuid,
                displayName,
                view: 'posts',
              });
            }}
          >
            {t('userinfo.view_posts')}
          </Button>
          {isLoggedIn && friendship === 'none' && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full border-0"
              onClick={() => void handleAddFriend()}
            >
              {t('moa_shell.right.presence_add_friend')}
            </Button>
          )}
          {isLoggedIn && friendship === 'incoming_pending' && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full border-0"
              onClick={() => void handleAcceptFriend()}
            >
              {t('moa_shell.right.presence_accept_friend')}
            </Button>
          )}
        </Div>,
        document.body,
      )}
    </Div>
  );
};

function presenceClientFormFactorIcon(formFactor?: ClientFormFactor | null): string | null {
  if (formFactor === 'mobile') return 'mobile-alt';
  if (formFactor === 'desktop') return 'desktop';
  return null;
}

/**
 * RightPanel 컴포넌트
 *
 * 우측 패널: 프로필, 접속자, 친구, 알림, 로그인 프롬프트
 */
export const RightPanel: React.FC<RightPanelProps> = ({
  width,
  rightOffset,
  isLoggedIn,
  currentUser,
  onOpenMyPage,
  onOpenAuth,
  onOpenShellSurface,
  onOpenUserProfile,
  isOverlay = false,
  overlayFlushEdges = false,
  onClose,
}) => {
  const { t } = useMoabomShellT();
  const { setNodeRef: setRightPanelDropRef } = useDroppable({ id: 'right-panel' });
  const [rightTab, setRightTab] = useState('connect');
  const settledRightTab = useShellSubTabSettle(rightTab);

  const openProfileSurface = useCallback((
    userUuid: string,
    displayName?: string,
    view: 'profile' | 'posts' = 'profile',
  ) => {
    if (onOpenShellSurface) {
      onOpenShellSurface({ kind: 'profile', userUuid, displayName, view });
      return;
    }
    onOpenUserProfile?.(userUuid, displayName, view);
  }, [onOpenShellSurface, onOpenUserProfile]);
  const profileActions = useMemo(
    () => PROFILE_ACTION_KEYS.map(row => ({ ...row, label: t(row.labelKey) })),
    [t],
  );
  const rightTabs = useMemo(
    () => RIGHT_TAB_KEYS.map(row => ({ id: row.id, label: t(row.labelKey) })),
    [t],
  );

  const {
    items: notificationItems,
    unreadCount,
    loading: notificationsLoading,
    markingAll,
    deletingAll,
    hasMore: notificationsHasMore,
    markAllRead,
    deleteAll,
    openNotification,
    loadMore: loadMoreNotifications,
    reloadList: reloadNotifications,
  } = useMoabomShellNotifications({
    isLoggedIn,
    alarmTabActive: settledRightTab === 'alarm',
    newNotificationToastText: t('moa_shell.right.new_notification_received'),
    newNotificationOpenText: t('moa_shell.right.notification_open'),
  });

  const {
    summary: presenceSummary,
    onlineUsers,
    friends,
    ownPresence,
    loadingOnline,
    loadingFriends,
    refreshOnline,
    refreshFriends,
    addFriend,
    acceptFriend,
  } = useMoabomPresence({
    connectTabActive: settledRightTab === 'connect',
    friendTabActive: settledRightTab === 'friend',
  });

  const onlineSummaryLabel = t('moa_shell.right.online_summary_live', {
    platform: presenceSummary?.platform_total ?? 0,
    tenant: presenceSummary?.tenant_active ?? 0,
  });

  const friendsSummaryLabel = t('moa_shell.right.friends_summary_live', {
    count: friends.length,
  });

  const ownStatusDotClass = presenceStatusDotClass(
    ownPresence?.availability ?? 'online',
    ownPresence?.is_reachable ?? isLoggedIn,
  );
  const ownAvatarAwayClass = presenceAvatarGrayscaleClass(
    ownPresence?.availability,
    ownPresence?.is_reachable ?? isLoggedIn,
  );
  const viewerUuid = isLoggedIn ? getShellAuthUserUuid() : null;

  const rightTabsWithBadges = useMemo(
    () => rightTabs.map(tab => (tab.id === 'alarm' ? { ...tab, badge: unreadCount } : tab)),
    [rightTabs, unreadCount],
  );

  const handleRightTabChange = useShellSubTabSelect(rightTab, settledRightTab, setRightTab, tabId => {
    if (tabId === 'connect') {
      void refreshOnline();
    } else if (tabId === 'friend') {
      void refreshFriends();
    } else if (tabId === 'alarm') {
      void reloadNotifications();
    }
  });

  const isOpen = rightOffset >= 0;
  /** 데스크톱 20px / 오버레이 기본 10px / 최소 구간 flush 시 0 */
  const panelEdge = !isOverlay ? MOA_HOME_EDGE : overlayFlushEdges ? 0 : MOA_HOME_OVERLAY_EDGE;
  const canAccessAdmin = Boolean(currentUser?.is_admin);
  const panelScrollRef = useRef<HTMLDivElement>(null);
  const panelScrollHandlers = useMoaPanelScrollDrag(panelScrollRef);
  const showNotificationLoadMore = notificationItems.length > MOABOM_SHELL_NOTIFICATION_PANEL_PAGE_SIZE
    || notificationsHasMore;

  /** 로그아웃 처리 */
  const handleLogout = () => {
    try {
      // 로그아웃 이후에도 사용자가 마지막으로 선택한 UI 언어를 유지한다.
      const preservedLocale = loadMoabomSystemState().preferences.language;
      localStorage.setItem('g7_locale', preservedLocale);

      const G7Core = (window as any).G7Core;
      if (G7Core?.AuthManager) {
        G7Core.AuthManager.getInstance().logout();
      } else {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };

  /** 프로필 액션 핸들러 */
  const handleProfileAction = (index: number) => {
    if (index === 0) onOpenMyPage?.('profile');
    if (index === 1) onOpenMyPage?.('settings');
    if (index === 2) onOpenMyPage?.('credit');
    if (index === 3) handleLogout();
  };

  /** 관리자 화면으로 이동합니다. */
  const handleOpenAdmin = () => {
    const G7Core = (window as any).G7Core;
    if (G7Core?.dispatch) {
      G7Core.dispatch({ handler: 'navigate', params: { path: '/admin' } });
      return;
    }

    window.location.href = '/admin';
  };

  return (
    <>
    <GlassPanel
      ref={setRightPanelDropRef}
      className={`${isOverlay ? 'moa-mobile-overlay-panel fixed moa-home-shell-overlay-inset-y' : 'absolute moa-home-shell-inset-y'}`}
      contentClassName="flex flex-col h-full w-full p-2 overflow-hidden"
      style={{
        width: `${width}px`,
        right: `${panelEdge}px`,
        zIndex: isOverlay ? 80 : 10,
        /** `overlayFlushEdges`: 우측 끝 직각·좌측만 라운드 / 그 외 전면 24px */
        borderRadius: !isOverlay ? '24px' : overlayFlushEdges ? '24px 0 0 24px' : '24px',
        transform: isOpen ? 'translate3d(0, 0, 0)' : 'translate3d(120%, 0, 0)',
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? undefined : 'none',
      }}
    >
      {isLoggedIn ? (
        <>
          {/* 프로필 카드 */}
          <Div className="glass rounded-2xl p-4 shrink-0 relative">
            <Div className="flex items-center gap-3">
              <Div className="relative shrink-0">
                {currentUser?.avatar ? (
                  <Img
                    src={currentUser.avatar}
                    alt={t('moa_shell.right.avatar_alt', { name: currentUser?.name || t('moa_shell.common.user_fallback') })}
                    className={`h-12 w-12 rounded-full object-cover shadow-lg${ownAvatarAwayClass ? ` ${ownAvatarAwayClass}` : ''}`}
                  />
                ) : (
                  <Div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg${ownAvatarAwayClass ? ` ${ownAvatarAwayClass}` : ''}`}
                    style={{ background: 'var(--moa-point-color)' }}
                  >
                    {(currentUser?.name || 'U').charAt(0).toUpperCase()}
                  </Div>
                )}
                <Div className={`moa-profile-status ${ownStatusDotClass}`} />
              </Div>
              <Div className="flex-1 min-w-0">
                <Div className="flex items-center gap-1.5">
                  <Span className="font-bold text-primary text-sm">{currentUser?.name || t('moa_shell.common.user_fallback')}</Span>
                  <Icon name="check-circle" className="text-xs" style={{ color: 'var(--moa-point-color)' }} />
                </Div>
                {/* 경험치 바 */}
                <Div className="w-full h-1.5 rounded-full mt-1.5 mb-1" style={{ background: 'color-mix(in srgb, var(--moa-point-color) 12%, transparent)' }}>
                  <Div className="h-full rounded-full" style={{ width: '74%', background: 'var(--moa-point-color)' }} />
                </Div>
                <Div className="flex items-center gap-1">
                  <Span className="text-xs font-bold" style={{ color: 'var(--moa-point-color)' }}>{t('moa_shell.left.creator_badge', { level: currentUser?.level || 1 })}</Span>
                  <Span className="text-xs text-muted">|</Span>
                  <Span className="text-xs text-muted">{(currentUser?.point || 0).toLocaleString()} P</Span>
                </Div>
              </Div>
            </Div>
            <Div className="grid grid-cols-4 gap-2 mt-4">
              {profileActions.map((b, i) => (
                <Button
                  key={i}
                  onClick={() => handleProfileAction(i)}
                  className={`w-full h-9 rounded-xl ${b.bg} flex items-center justify-center border-0 hover:opacity-80 transition-all cursor-pointer`}
                  title={b.label}
                >
                  <Icon
                    name={b.icon}
                    className={`text-base ${b.color}`}
                  />
                </Button>
              ))}
            </Div>
            {canAccessAdmin && (
              <Button
                onClick={handleOpenAdmin}
                variant="primary-outline"
                size="sm"
                className="w-full mt-3 shadow-md"
              >
                <Icon name="user-shield" />
                <Span>{t('moa_shell.right.admin_mode')}</Span>
              </Button>
            )}
          </Div>

          {/* 탭 콘텐츠: 상단 탭은 고정, 목록만 스크롤 */}
          <Div className="relative min-h-0 flex-1">
            <Div
              ref={panelScrollRef}
              className="moa-panel-scroll absolute inset-0 overflow-y-auto px-3 scrollbar-hide"
              style={{ paddingTop: `${MOABOM_SHELL_SUB_TAB_SLOT_PX}px` }}
              {...panelScrollHandlers}
            >
              {/* 접속자 탭 */}
              {rightTab === 'connect' && (
                <Div className="py-3">
                  <>
                    <Span className="text-xs text-muted px-1 block">{onlineSummaryLabel}</Span>
                    {loadingOnline && onlineUsers.length === 0 && (
                      <Moa_PanelLoadingState label={t('moa_shell.right.presence_loading')} />
                    )}
                    {!loadingOnline && onlineUsers.length === 0 && (
                      <Moa_PanelEmptyState
                        icon="globe"
                        message={t('moa_shell.right.presence_empty')}
                      />
                    )}
                    <Div className="mt-2 flex flex-col gap-1">
                      {onlineUsers.map(u => {
                        const deviceIcon = presenceClientFormFactorIcon(u.client_form_factor);
                        const listStatus = resolvePresenceListUserStatus(u, ownPresence, viewerUuid);
                        const avatarGrayscaleClass = presenceAvatarGrayscaleClass(listStatus.availability, listStatus.isReachable);
                        const statusDotClass = presenceStatusDotClass(listStatus.availability, listStatus.isReachable);
                        return (
                        <Div
                          key={u.visitor_id ?? u.session_key}
                          className="group flex items-center gap-2 py-2 rounded-xl hover:opacity-90 transition-all cursor-pointer"
                          onClick={() => {
                            if (u.user_uuid) {
                              openProfileSurface(u.user_uuid, u.display_name);
                            }
                          }}
                        >
                          <Div className="relative shrink-0">
                            {u.avatar ? (
                              <Img
                                src={u.avatar}
                                alt={u.display_name}
                                className={`w-10 h-10 rounded-full object-cover${avatarGrayscaleClass ? ` ${avatarGrayscaleClass}` : ''}`}
                              />
                            ) : (
                              <Div
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold${avatarGrayscaleClass ? ` ${avatarGrayscaleClass}` : ''}`}
                                style={{ background: 'var(--moa-point-color)' }}
                              >
                                {(u.display_name || '?').charAt(0).toUpperCase()}
                              </Div>
                            )}
                            <Div className={`moa-status-dot ${statusDotClass}`} />
                          </Div>
                          <Div className="flex-1 min-w-0">
                            <Moa_OverflowMarqueeText text={u.display_name} className="text-sm font-bold text-primary" />
                            <Moa_OverflowMarqueeText
                              text={resolvePresenceListStatusLine(t, u, ownPresence, viewerUuid, listStatus.isReachable)}
                              className="text-xs text-muted mt-0.5"
                            />
                          </Div>
                          {deviceIcon ? (
                            <Icon
                              name={deviceIcon}
                              className="icon-muted shrink-0 text-xs"
                              ariaLabel={t(u.client_form_factor === 'mobile'
                                ? 'moa_shell.right.presence_device_mobile'
                                : 'moa_shell.right.presence_device_desktop')}
                            />
                          ) : null}
                          {u.user_uuid && (
                            <PresenceUserActionsMenu
                              userUuid={u.user_uuid}
                              displayName={u.display_name}
                              friendship={u.friendship}
                              isLoggedIn={isLoggedIn}
                              onOpenShellSurface={onOpenShellSurface}
                              onAddFriend={addFriend}
                              onAcceptFriend={acceptFriend}
                            />
                          )}
                        </Div>
                        );
                      })}
                    </Div>
                  </>
                </Div>
              )}

              {/* 친구 탭 */}
              {rightTab === 'friend' && (
                <Div className="py-3">
                  <>
                    <Span className="text-xs text-muted px-1 block">{friendsSummaryLabel}</Span>
                    {!isLoggedIn && (
                      <Moa_PanelEmptyState
                        icon="lock"
                        message={t('moa_shell.right.friends_login_required')}
                      />
                    )}
                    {isLoggedIn && loadingFriends && friends.length === 0 && (
                      <Moa_PanelLoadingState label={t('moa_shell.right.presence_loading')} />
                    )}
                    {isLoggedIn && !loadingFriends && friends.length === 0 && (
                      <Moa_PanelEmptyState
                        icon="users"
                        message={t('moa_shell.right.friends_empty')}
                      />
                    )}
                    <Div className="mt-2 flex flex-col gap-1">
                      {friends.map(u => {
                        const listStatus = resolvePresenceListUserStatus(u, ownPresence, viewerUuid);
                        const avatarGrayscaleClass = presenceAvatarGrayscaleClass(listStatus.availability, listStatus.isReachable);
                        const statusDotClass = presenceStatusDotClass(listStatus.availability, listStatus.isReachable);
                        return (
                        <Div
                          key={u.user_uuid}
                          className="group flex items-center gap-2 py-2 rounded-xl hover:opacity-90 transition-all cursor-pointer"
                          onClick={() => openProfileSurface(u.user_uuid, u.display_name)}
                        >
                          <Div className="relative shrink-0">
                            {u.avatar ? (
                              <Img
                                src={u.avatar}
                                alt={u.display_name}
                                className={`w-10 h-10 rounded-full object-cover${avatarGrayscaleClass ? ` ${avatarGrayscaleClass}` : ''}`}
                              />
                            ) : (
                              <Div
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold${avatarGrayscaleClass ? ` ${avatarGrayscaleClass}` : ''}`}
                                style={{ background: 'var(--moa-point-color)' }}
                              >
                                {(u.display_name || '?').charAt(0).toUpperCase()}
                              </Div>
                            )}
                            <Div className={`moa-status-dot ${statusDotClass}`} />
                          </Div>
                          <Div className="flex-1 min-w-0">
                            <Moa_OverflowMarqueeText text={u.display_name} className="text-sm font-bold text-primary" />
                            <Moa_OverflowMarqueeText
                              text={resolvePresenceListStatusLine(t, u, ownPresence, viewerUuid, listStatus.isReachable)}
                              className="text-xs text-muted mt-0.5"
                            />
                          </Div>
                          <FriendChatOpenButton userUuid={u.user_uuid} />
                        </Div>
                        );
                      })}
                    </Div>
                  </>
                </Div>
              )}

              {/* 알림 탭 */}
              {rightTab === 'alarm' && (
                <Div className="py-3">
                  <Div className="flex flex-col gap-1">
                    {notificationsLoading && notificationItems.length === 0 && (
                      <Moa_PanelLoadingState label={t('moa_shell.right.notifications_loading')} />
                    )}
                    {!notificationsLoading && notificationItems.length === 0 && (
                      <Moa_PanelEmptyState
                        icon="bell"
                        message={t('moa_shell.right.notifications_empty')}
                      />
                    )}
                    {notificationItems.map(item => {
                      const visual = getNotificationVisual(item.type);
                      const title = item.subject?.trim() || item.type_label || t('moa_shell.right.notification_fallback_title');
                      const desc = item.body?.trim() || '';
                      const timeLabel = resolveRelativeTimeLabel(
                        formatNotificationRelativeTime(item.created_at),
                        t,
                      );
                      const unread = isShellNotificationUnread(item.read_at);

                      return (
                        <Div
                          key={item.id}
                          onClick={() => { void openNotification(item); }}
                          className={`flex items-start gap-2 p-3 rounded-lg transition-all cursor-pointer hover:opacity-90 ${unread ? 'glass-sm' : ''}`}
                        >
                          <Div className={`w-9 h-9 rounded-full ${visual.iconBg} flex items-center justify-center shrink-0`}>
                            <Icon name={visual.icon} className={`text-base ${visual.iconColor}`} />
                          </Div>
                          <Div className="flex-1 min-w-0">
                            <Moa_OverflowMarqueeText text={title} className="text-sm font-bold text-primary" />
                            {desc ? (
                              <Moa_OverflowMarqueeText text={desc} className="text-xs text-muted mt-0.5" />
                            ) : null}
                          </Div>
                          <Span className="text-xs text-muted shrink-0 mt-0.5">{timeLabel}</Span>
                        </Div>
                      );
                    })}
                    {showNotificationLoadMore ? (
                      <Div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="dark-outline"
                          size="sm"
                          className="flex-1 min-w-0"
                          disabled={markingAll || unreadCount === 0}
                          onClick={() => { void markAllRead(); }}
                        >
                          {t('moa_shell.right.mark_all_read')}
                        </Button>
                        <Button
                          variant="dark-outline"
                          size="sm"
                          className="flex-1 min-w-0"
                          disabled={notificationsLoading || !notificationsHasMore}
                          onClick={() => { void loadMoreNotifications(); }}
                        >
                          {t('moa_shell.right.notifications_load_more')}
                        </Button>
                        <Button
                          type="button"
                          variant="dark-outline"
                          size="sm"
                          className="shrink-0 px-3"
                          disabled={deletingAll || notificationItems.length === 0}
                          onClick={() => { void deleteAll(); }}
                          aria-label={t('moa_shell.right.notifications_delete_all')}
                          title={t('moa_shell.right.notifications_delete_all')}
                        >
                          <Icon name="trash" className="text-sm" />
                        </Button>
                      </Div>
                    ) : (
                      <Div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="dark-outline"
                          size="sm"
                          className="flex-1 min-w-0"
                          disabled={markingAll || unreadCount === 0}
                          onClick={() => { void markAllRead(); }}
                        >
                          {t('moa_shell.right.mark_all_read')}
                        </Button>
                        <Button
                          type="button"
                          variant="dark-outline"
                          size="sm"
                          className="shrink-0 px-3"
                          disabled={deletingAll || notificationItems.length === 0}
                          onClick={() => { void deleteAll(); }}
                          aria-label={t('moa_shell.right.notifications_delete_all')}
                          title={t('moa_shell.right.notifications_delete_all')}
                        >
                          <Icon name="trash" className="text-sm" />
                        </Button>
                      </Div>
                    )}
                  </Div>
                </Div>
              )}
            </Div>

            <Div className="absolute top-0 left-0 right-0 z-10 py-2">
              <SubTabBar tabs={rightTabsWithBadges} activeTab={rightTab} onTabChange={handleRightTabChange} />
            </Div>
          </Div>

          <Moa_RightPanelAdSlot />
        </>
      ) : (
        <>
          <Div className="relative min-h-0 flex-1 w-full">
            <LoginPrompt onOpenAuth={onOpenAuth} />
          </Div>
          <Moa_RightPanelAdSlot />
        </>
      )}
    </GlassPanel>
    {isOverlay && isOpen && (
      <Button
        onClick={onClose}
        className="moa-panel-outside-close moa-panel-outside-close-right"
        style={{ right: `${panelEdge + width + 8}px` }}
        aria-label={t('moa_shell.right.close_panel')}
      >
        <Icon name="times" className="text-white text-sm drop-shadow" />
      </Button>
    )}
    </>
  );
};
