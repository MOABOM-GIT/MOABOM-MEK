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
import { Moa_OverflowMarqueeText } from './Moa_OverflowMarqueeText';
import { SubTabBar } from './Moa_SubTabBar';
import { LoginPrompt } from './Moa_LoginPrompt';
import { useMoabomPresence } from '../../hooks/useMoabomPresence';
import type { MyPageTab } from './Moa_MyPageWindowContent';
import type { AuthWindowMode } from './Moa_AuthWindowContent';
import { MOABOM_SHELL_SUB_TAB_SLOT_PX } from '../../layout/moabomShellPanelLayout';
import { loadMoabomSystemState } from '../../utils/moabomSystemStore';
import { useMoabomShellNotifications } from '../../hooks/useMoabomShellNotifications';
import {
  formatNotificationRelativeTime,
  getNotificationVisual,
  resolveRelativeTimeLabel,
} from '../../utils/moabomNotificationPresentation';
import { isShellNotificationUnread } from '../../utils/moabomShellNotificationUtils';
import { MOA_HOME_EDGE, MOA_HOME_OVERLAY_EDGE } from '../../shell/moaShellLayoutConstants';
import type { MoabomTranslateFn } from '../../i18n/moabomT';
import type { PresenceAvailability, ClientFormFactor } from '../../api/moabomPresenceApi';
import { presenceStatusDotClass, resolvePresenceSubtitle } from '../../utils/presenceAvailability';
import { pushShellPath } from '../../utils/moabomShellRoutes';
import { pushInfoToast, pushWarningToast } from '../../runtime/moaShellToasts';

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
  /** 공개 프로필 윈도우 열기 */
  onOpenUserProfile?: (userUuid: string, displayName?: string) => void;
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

interface PresenceUserActionsMenuProps {
  userUuid: string;
  displayName: string;
  friendship?: 'none' | 'outgoing_pending' | 'incoming_pending' | 'accepted';
  isLoggedIn: boolean;
  onOpenUserProfile?: (userUuid: string, displayName?: string) => void;
  onAddFriend: (userUuid: string) => void | Promise<void>;
  onAcceptFriend: (userUuid: string) => void | Promise<void>;
}

/** 접속자 행 — 세로 … 메뉴 (Portal fixed — 패널 overflow 클리핑 회피) */
const PresenceUserActionsMenu: React.FC<PresenceUserActionsMenuProps> = ({
  userUuid,
  displayName,
  friendship,
  isLoggedIn,
  onOpenUserProfile,
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
      pushInfoToast(t('moa_shell.right.presence_friend_request_sent'));
    } catch {
      pushWarningToast(t('moa_shell.right.presence_friend_request_failed'));
    }
  };

  const handleAcceptFriend = async () => {
    setOpen(false);
    try {
      await onAcceptFriend(userUuid);
      pushInfoToast(t('moa_shell.right.presence_friend_accepted'));
    } catch {
      pushWarningToast(t('moa_shell.right.presence_friend_request_failed'));
    }
  };

  return (
    <Div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <Button
        ref={buttonRef}
        type="button"
        className="w-7 h-7 rounded-lg glass-sm flex items-center justify-center border-0 shrink-0 cursor-pointer hover:opacity-90"
        aria-label={t('moa_shell.right.presence_menu')}
        aria-expanded={open}
        onClick={() => {
          if (!open) updateMenuPosition();
          setOpen(prev => !prev);
        }}
      >
        <Icon name="ellipsis-v" className="icon-muted text-sm" />
      </Button>
      {open && createPortal(
        <Div
          ref={menuRef}
          className="fixed z-[9999] min-w-[9.5rem] rounded-xl glass-sm p-1 shadow-lg"
          style={{ top: menuPosition.top, left: menuPosition.left, width: PRESENCE_MENU_WIDTH_PX }}
        >
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full justify-start border-0"
            onClick={() => {
              setOpen(false);
              onOpenUserProfile?.(userUuid, displayName);
            }}
          >
            {t('moa_shell.right.presence_view_profile')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full justify-start border-0"
            onClick={() => {
              setOpen(false);
              pushShellPath(`/users/${encodeURIComponent(userUuid)}/posts`);
              onOpenUserProfile?.(userUuid, displayName);
            }}
          >
            {t('userinfo.view_posts')}
          </Button>
          {isLoggedIn && friendship === 'none' && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full justify-start border-0"
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
              className="w-full justify-start border-0"
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

function resolvePresenceStatusLine(
  t: MoabomTranslateFn,
  user: {
    presence_subtitle?: string | null;
    status_text?: string | null;
    availability?: PresenceAvailability;
    is_online: boolean;
  },
): string {
  const subtitle = resolvePresenceSubtitle(user);
  if (subtitle) {
    return subtitle;
  }
  if (!user.is_online) {
    return t('moa_shell.right.presence_offline');
  }
  switch (user.availability) {
    case 'busy':
      return t('moa_shell.right.presence_busy');
    case 'away':
      return t('moa_shell.right.presence_away');
    case 'offline':
      return t('moa_shell.right.presence_offline');
    default:
      return t('moa_shell.right.presence_active');
  }
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
  onOpenUserProfile,
  isOverlay = false,
  overlayFlushEdges = false,
  onClose,
}) => {
  const { t } = useMoabomShellT();
  const { setNodeRef: setRightPanelDropRef } = useDroppable({ id: 'right-panel' });
  const [rightTab, setRightTab] = useState('connect');
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
    hasMore: notificationsHasMore,
    markAllRead,
    openNotification,
    loadMore: loadMoreNotifications,
  } = useMoabomShellNotifications({
    isLoggedIn,
    alarmTabActive: rightTab === 'alarm',
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
    addFriend,
    acceptFriend,
  } = useMoabomPresence({
    isLoggedIn,
    connectTabActive: rightTab === 'connect',
    friendTabActive: rightTab === 'friend',
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

  const rightTabsWithBadges = useMemo(
    () => rightTabs.map(tab => (tab.id === 'alarm' ? { ...tab, badge: unreadCount } : tab)),
    [rightTabs, unreadCount],
  );

  const isOpen = rightOffset >= 0;
  /** 데스크톱 20px / 오버레이 기본 10px / 최소 구간 flush 시 0 */
  const panelEdge = !isOverlay ? MOA_HOME_EDGE : overlayFlushEdges ? 0 : MOA_HOME_OVERLAY_EDGE;
  const canAccessAdmin = Boolean(currentUser?.is_admin);
  const panelScrollRef = useRef<HTMLDivElement>(null);
  const panelScrollHandlers = useMoaPanelScrollDrag(panelScrollRef);

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
                    className="h-12 w-12 rounded-full object-cover shadow-lg"
                  />
                ) : (
                  <Div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg"
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
                size="medium"
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
                      <Span className="text-xs text-muted px-3 py-4 text-center block">
                        {t('moa_shell.right.presence_loading')}
                      </Span>
                    )}
                    {!loadingOnline && onlineUsers.length === 0 && (
                      <Span className="text-xs text-muted px-3 py-4 text-center block">
                        {t('moa_shell.right.presence_empty')}
                      </Span>
                    )}
                    <Div className="mt-2 flex flex-col gap-1">
                      {onlineUsers.map(u => {
                        const deviceIcon = presenceClientFormFactorIcon(u.client_form_factor);
                        return (
                        <Div
                          key={u.session_key}
                          className="group flex items-center gap-2 py-2 rounded-xl hover:opacity-90 transition-all cursor-pointer"
                          onClick={() => {
                            if (u.user_uuid) {
                              onOpenUserProfile?.(u.user_uuid, u.display_name);
                            }
                          }}
                        >
                          <Div className="relative shrink-0">
                            {u.avatar ? (
                              <Img
                                src={u.avatar}
                                alt={u.display_name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <Div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                                style={{ background: 'var(--moa-point-color)' }}
                              >
                                {(u.display_name || '?').charAt(0).toUpperCase()}
                              </Div>
                            )}
                            <Div className={`moa-status-dot ${presenceStatusDotClass(u.availability, u.is_online)}`} />
                          </Div>
                          <Div className="flex-1 min-w-0">
                            <Moa_OverflowMarqueeText text={u.display_name} className="text-sm font-bold text-primary" />
                            <Moa_OverflowMarqueeText
                              text={resolvePresenceStatusLine(t, u)}
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
                              onOpenUserProfile={onOpenUserProfile}
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
                      <Span className="text-xs text-muted px-3 py-4 text-center block">
                        {t('moa_shell.right.friends_login_required')}
                      </Span>
                    )}
                    {isLoggedIn && loadingFriends && friends.length === 0 && (
                      <Span className="text-xs text-muted px-3 py-4 text-center block">
                        {t('moa_shell.right.presence_loading')}
                      </Span>
                    )}
                    {isLoggedIn && !loadingFriends && friends.length === 0 && (
                      <Span className="text-xs text-muted px-3 py-4 text-center block">
                        {t('moa_shell.right.friends_empty')}
                      </Span>
                    )}
                    <Div className="mt-2 flex flex-col gap-1">
                      {friends.map(u => (
                        <Div
                          key={u.user_uuid}
                          className={`group flex items-center gap-2 py-2 rounded-xl hover:opacity-90 transition-all cursor-pointer ${!u.is_online ? 'opacity-70' : ''}`}
                          onClick={() => onOpenUserProfile?.(u.user_uuid, u.display_name)}
                        >
                          <Div className="relative shrink-0">
                            {u.avatar ? (
                              <Img src={u.avatar} alt={u.display_name} className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                              <Div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                                style={{ background: 'var(--moa-point-color)' }}
                              >
                                {(u.display_name || '?').charAt(0).toUpperCase()}
                              </Div>
                            )}
                            <Div className={`moa-status-dot ${presenceStatusDotClass(u.availability, u.is_online)}`} />
                          </Div>
                          <Div className="flex-1 min-w-0">
                            <Moa_OverflowMarqueeText text={u.display_name} className="text-sm font-bold text-primary" />
                            <Moa_OverflowMarqueeText
                              text={resolvePresenceStatusLine(t, u)}
                              className="text-xs text-muted mt-0.5"
                            />
                          </Div>
                        </Div>
                      ))}
                    </Div>
                  </>
                </Div>
              )}

              {/* 알림 탭 */}
              {rightTab === 'alarm' && (
                <Div className="py-3">
                  <Div className="flex flex-col gap-1">
                    {notificationsLoading && notificationItems.length === 0 && (
                      <Span className="text-xs text-muted px-3 py-4 text-center block">
                        {t('moa_shell.right.notifications_loading')}
                      </Span>
                    )}
                    {!notificationsLoading && notificationItems.length === 0 && (
                      <Span className="text-xs text-muted px-3 py-4 text-center block">
                        {t('moa_shell.right.notifications_empty')}
                      </Span>
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
                    {notificationsHasMore && (
                      <Button
                        variant="dark-outline"
                        size="medium"
                        className="w-full mt-1"
                        disabled={notificationsLoading}
                        onClick={() => { void loadMoreNotifications(); }}
                      >
                        {t('moa_shell.right.notifications_load_more')}
                      </Button>
                    )}
                    <Button
                      variant="dark-outline"
                      size="medium"
                      className="w-full mt-2"
                      disabled={markingAll || unreadCount === 0}
                      onClick={() => { void markAllRead(); }}
                    >
                      {t('moa_shell.right.mark_all_read')}
                    </Button>
                  </Div>
                </Div>
              )}
            </Div>

            <Div className="absolute top-0 left-0 right-0 z-10 py-2">
              <SubTabBar tabs={rightTabsWithBadges} activeTab={rightTab} onTabChange={setRightTab} />
            </Div>
          </Div>
        </>
      ) : (
        <LoginPrompt onOpenAuth={onOpenAuth} />
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
