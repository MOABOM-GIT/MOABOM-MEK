import React, { useMemo, useState } from 'react';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
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
import { ONLINE_USERS, FRIENDS_DATA, NOTIFICATIONS_DATA } from '../../data/Moa_mockData';
import type { MyPageTab } from './Moa_MyPageWindowContent';
import type { AuthWindowMode } from './Moa_AuthWindowContent';
import { MOABOM_SHELL_SUB_TAB_SLOT_PX } from '../../layout/moabomShellPanelLayout';
import { loadMoabomSystemState } from '../../utils/moabomSystemStore';

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
  isOverlay = false,
  overlayFlushEdges = false,
  onClose,
}) => {
  const { t } = useMoabomShellT();
  const profileActions = useMemo(
    () => PROFILE_ACTION_KEYS.map(row => ({ ...row, label: t(row.labelKey) })),
    [t],
  );
  const rightTabs = useMemo(
    () => RIGHT_TAB_KEYS.map(row => ({ id: row.id, label: t(row.labelKey) })),
    [t],
  );

  const { setNodeRef: setRightPanelDropRef } = useDroppable({ id: 'right-panel' });
  const [rightTab, setRightTab] = useState('connect');
  const isOpen = rightOffset >= 0;
  /** 데스크톱 20px / 오버레이 기본 10px / 최소 구간 flush 시 0 */
  const panelEdge = !isOverlay ? 20 : overlayFlushEdges ? 0 : 10;
  const canAccessAdmin = Boolean(currentUser?.is_admin);

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
        localStorage.removeItem('auth_token');
        window.location.reload();
      }
    } catch {
      localStorage.removeItem('auth_token');
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
      className={`${isOverlay ? 'moa-mobile-overlay-panel fixed top-2.5 bottom-2.5' : 'absolute top-5 bottom-5'}`}
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
                <Div className="moa-profile-status moa-status-online" />
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
              className="absolute inset-0 overflow-y-auto px-3"
              style={{ paddingTop: `${MOABOM_SHELL_SUB_TAB_SLOT_PX}px` }}
            >
              {/* 접속자 탭 */}
              {rightTab === 'connect' && (
                <Div className="py-3">
                  <>
                    <Span className="text-xs text-muted px-1 block">{t('moa_shell.right.online_summary')}</Span>
                    <Div className="mt-2 flex flex-col gap-1">
                      {ONLINE_USERS.map(u => (
                        <Div key={u.n} className="group flex items-center gap-2 py-2 rounded-xl hover:opacity-90 transition-all cursor-pointer">
                          <Div className="relative shrink-0">
                            <Div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: u.c }}>
                              {u.i}
                            </Div>
                            <Div className={`moa-status-dot ${u.online ? 'moa-status-online' : 'moa-status-idle'}`} />
                          </Div>
                          <Div className="flex-1 min-w-0">
                            <Moa_OverflowMarqueeText text={u.n} className="text-sm font-bold text-primary" />
                            <Moa_OverflowMarqueeText text={u.s} className="text-xs text-muted mt-0.5" />
                          </Div>
                          <Button className="w-7 h-7 rounded-lg glass-sm flex items-center justify-center border-0 shrink-0 cursor-pointer hover:opacity-90">
                            <Icon name="ellipsis-v" className="icon-muted text-sm" />
                          </Button>
                        </Div>
                      ))}
                    </Div>
                  </>
                </Div>
              )}

              {/* 친구 탭 */}
              {rightTab === 'friend' && (
                <Div className="py-3">
                  <>
                    <Span className="text-xs text-muted px-1 block">{t('moa_shell.right.friends_summary')}</Span>
                    <Div className="mt-2 flex flex-col gap-1">
                      {FRIENDS_DATA.map(u => (
                        <Div
                          key={u.n}
                          className={`group flex items-center gap-2 py-2 rounded-xl hover:opacity-90 transition-all cursor-pointer ${!u.online ? 'opacity-50' : ''}`}
                        >
                          <Div className="relative shrink-0">
                            <Div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden" style={{ background: u.c }}>
                              <Icon name="user" className="text-base" />
                            </Div>
                            <Div className={`moa-status-dot ${u.online ? 'moa-status-online' : 'moa-status-offline'}`} />
                          </Div>
                          <Div className="flex-1 min-w-0">
                            <Moa_OverflowMarqueeText text={u.n} className="text-sm font-bold text-primary" />
                            <Moa_OverflowMarqueeText text={u.s} className="text-xs text-muted mt-0.5" />
                          </Div>
                          <Button className="w-8 h-8 rounded-lg glass-sm flex items-center justify-center border-0 shrink-0 hover:opacity-90 cursor-pointer">
                            <Icon name={u.online ? 'comment-dots' : 'paper-plane'} className="icon-muted text-sm" />
                          </Button>
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
                    {NOTIFICATIONS_DATA.map((a, i) => (
                      <Div key={i} className={`flex items-start gap-2 p-3 rounded-lg transition-all cursor-pointer hover:opacity-90 ${a.unread ? 'glass-sm' : ''}`}>
                        <Div className={`w-9 h-9 rounded-full ${a.iconBg} flex items-center justify-center shrink-0`}>
                          <Icon name={a.icon} className={`text-base ${a.iconColor}`} />
                        </Div>
                        <Div className="flex-1 min-w-0">
                          <Moa_OverflowMarqueeText text={a.title} className="text-sm font-bold text-primary" />
                          <Moa_OverflowMarqueeText text={a.desc} className="text-xs text-muted mt-0.5" />
                        </Div>
                        <Span className="text-xs text-muted shrink-0 mt-0.5">{a.time}</Span>
                      </Div>
                    ))}
                    <Button variant="dark-outline" size="medium" className="w-full mt-2">
                      {t('moa_shell.right.mark_all_read')}
                    </Button>
                  </Div>
                </Div>
              )}
            </Div>

            <Div className="absolute top-0 left-0 right-0 z-10 py-2">
              <SubTabBar tabs={rightTabs} activeTab={rightTab} onTabChange={setRightTab} />
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
