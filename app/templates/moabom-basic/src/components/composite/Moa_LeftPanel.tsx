import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMoabomDarkMode } from '../../hooks/useMoabomDarkMode';
import { useMoaPanelScrollDrag } from '../../hooks/Moa_usePanelScrollDrag';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import { useDroppable } from '@dnd-kit/core';
import { Div } from '../basic/Div';
import { Button } from '../basic/Button';
import { Icon } from '../basic/Icon';
import { Span } from '../basic/Span';
import { Img } from '../basic/Img';
import { GlassPanel } from './Moa_GlassPanel';
import { SubTabBar } from './Moa_SubTabBar';
import { LeftPanelAppIcon } from './Moa_LeftPanelAppIcon';
import { createAppShellMetadata } from '../../apps/ai-generator/metadata';
import { APPS, type App } from '../../data/Moa_apps';
import { NAV_ITEMS } from '../../data/Moa_navigation';
import {
  fetchShellAppRankings,
  fetchShellUserRankings,
  shellRankingAvatarGradient,
  shellRankingAvatarLabel,
} from '../../api/moabomShellRankingsApi';
import type { ShellAppRankingItem, ShellUserRankingItem } from '../../shell/moaShellRankingTypes';
import {
  openShellNoticeBoard,
  MOA_SHELL_NOTICE_BOARD_SLUG,
} from '../../shell/moaShellNoticeBoard';
import { fetchShellNoticeBoardPreview } from '../../shell/moaShellNoticeBoardPreview';
import {
  subscribeShellNoticeBoardChanged,
  type ShellNoticeBoardChangedDetail,
} from '../../shell/moaShellNoticeBoardEvents';
import { deferShellSecondaryWork, deferShellTertiaryWork } from '../../shell/moaShellDeferredWork';
import { prefetchBoardWindowLayouts } from '../../shell/boardWindowPrefetch';
import type { NoticeBadgeKind, ShellNoticePreviewItem } from '../../shell/moaShellNoticeBoardPreview';
import { useResolvedAppStrings } from '../../i18n/useResolvedAppStrings';
import { MOABOM_SHELL_LEFT_PANEL_BOTTOM_SLOT_PX, MOABOM_SHELL_SUB_TAB_SLOT_PX } from '../../layout/moabomShellPanelLayout';
import { MOA_HOME_EDGE, MOA_HOME_OVERLAY_EDGE } from '../../shell/moaShellLayoutConstants';
import { resolveMoabomSiteLogoImgRecoveryUrl, useMoabomSiteLogoUrls } from '../../utils/moabomSiteBranding';
import { useShellSubTabSelect, useShellSubTabSettle } from '../../hooks/useShellSubTabSelect';
import { Moa_PanelEmptyState } from './Moa_PanelEmptyState';
import { Moa_PanelLoadingState } from './Moa_PanelLoadingState';

type LeftPanelNoticeItem = ShellNoticePreviewItem;

function getNoticeBadgeClassName(kind: NoticeBadgeKind): string {
  switch (kind) {
    case 'new':
      return 'bg-emerald-500 text-white';
    case 'popular':
      return 'bg-amber-500 text-white';
    case 'notice':
      return 'bg-sky-500 text-white';
    case 'update':
      return 'text-white';
    default:
      return 'bg-slate-500 text-white';
  }
}

export interface LeftPanelProps {
  /** 패널 너비 */
  width: number;
  /** 패널 왼쪽 오프셋 */
  leftOffset: number;
  /** 앱 열기 핸들러 */
  onOpenApp: (app: App) => void;
  /** 앱 추가 핸들러 */
  onAddApp: (app: App) => void;
  /** 현재 앱 카테고리 탭 */
  activeTab: 'basic' | 'user';
  /** 앱 카테고리 탭 변경 핸들러 */
  onTabChange: (tab: 'basic' | 'user') => void;
  /** 편집 모드 여부 */
  editMode: boolean;
  /** 편집 모드 진입 핸들러 */
  onEnterEditMode: () => void;
  /** 즐겨찾기 앱 목록 */
  favoriteApps: App[];
  /** 사용자가 저장한 AI 생성 앱 목록 */
  createdApps?: App[];
  /** 로그인 사용자 생성앱 라이브러리 API 동기화 중 */
  ownedGeneratedAppsLoading?: boolean;
  /** 다른 사용자가 공유 공개한 AI 생성 앱 목록 */
  sharedApps?: App[];
  /** 좁은 화면 오버레이 모드 여부 */
  isOverlay?: boolean;
  /**
   * 가장 좁은 구간(기본 480px 이하)에서만 true — 패널을 화면 끝에 붙이고 안쪽 모서리만 라운드.
   * `isOverlay`일 때만 의미 있음.
   */
  overlayFlushEdges?: boolean;
  /** 오버레이 닫기 핸들러 */
  onClose?: () => void;
  /** 게시판 윈도우 열기 (좌측 공지·업데이트 더미 → notice 보드) */
  onOpenBoard?: (slug: string, postId?: string) => void;
  /** 공개 프로필 윈도우 열기 */
  onOpenUserProfile?: (userUuid: string, displayName?: string) => void;
}

/** 랭킹 행 — 앱 이름·설명(좁은 패널·마퀴 높이 이슈 없이 말줄임으로 항상 표시) */
function RankingAppTexts({ app, emptyDescriptionFallback }: { app: App; emptyDescriptionFallback: string }) {
  const { name, description } = useResolvedAppStrings(app);
  const desc = description.trim();
  const sub = desc || emptyDescriptionFallback;
  return (
    <Div className="min-w-0 w-full">
      <Span className="font-bold text-primary text-sm block truncate" title={name}>
        {name}
      </Span>
      <Span className="text-xs text-muted block truncate mt-0.5" title={sub}>
        {sub}
      </Span>
    </Div>
  );
}

const LEFT_PANEL_APP_GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  padding: '10px 0',
  /** center면 아이템이 콘텐츠 폭만 잡혀 긴 라벨이 옆 셀과 겹침 — 셀 폭을 쓰려면 stretch */
  justifyItems: 'stretch',
};

/**
 * 즐겨찾기/마이앱/랭킹 아이템을 LeftPanelAppIcon에 전달할 수 있도록
 * App 형태로 변환하는 헬퍼
 */
function resolveRankingApp(appId: string, libraryApps: App[]): App {
  const found = libraryApps.find(app => app.id === appId) ?? APPS.find(app => app.id === appId);
  if (found) {
    return found;
  }

  return {
    id: appId,
    name: appId,
    description: '',
    icon: 'cube',
    gradient: 'linear-gradient(135deg,#64748b,#334155)',
    category: 'user',
    source: 'user-created',
  };
}

interface LeftPanelAppGridProps {
  apps: App[];
  editMode: boolean;
  onEnterEditMode: () => void;
  onOpenApp: (app: App) => void;
  onAddApp: (app: App) => void;
  tapToAdd: boolean;
  children?: React.ReactNode;
}

const LeftPanelAppGrid: React.FC<LeftPanelAppGridProps> = ({
  apps,
  editMode,
  onEnterEditMode,
  onOpenApp,
  onAddApp,
  tapToAdd,
  children,
}) => (
  <Div className="moa-left-panel-app-grid" style={LEFT_PANEL_APP_GRID_STYLE}>
    {apps.map(app => (
      <LeftPanelAppIcon
        key={app.id}
        app={app}
        editMode={editMode}
        onEnterEditMode={onEnterEditMode}
        onOpenApp={onOpenApp}
        onAddApp={onAddApp}
        tapToAdd={tapToAdd}
      />
    ))}
    {children}
  </Div>
);

/**
 * LeftPanel 컴포넌트
 *
 * 좌측 패널: 로고, 앱 그리드, 랭킹, 마이앱, 공지, 네비게이션
 */
export const LeftPanel: React.FC<LeftPanelProps> = ({
  width,
  leftOffset,
  onOpenApp,
  onAddApp,
  activeTab,
  onTabChange,
  editMode,
  onEnterEditMode,
  favoriteApps,
  createdApps = [],
  ownedGeneratedAppsLoading = false,
  sharedApps = [],
  isOverlay = false,
  overlayFlushEdges = false,
  onClose,
  onOpenBoard,
  onOpenUserProfile,
}) => {
  const isDark = useMoabomDarkMode();
  const { t } = useMoabomShellT();
  const { lightUrl: logoImageLight, darkUrl: logoImageDark } = useMoabomSiteLogoUrls();
  const preferredLogoSrc = isDark ? logoImageDark : logoImageLight;
  const [logoSrc, setLogoSrc] = useState(preferredLogoSrc);

  useEffect(() => {
    setLogoSrc(preferredLogoSrc);
  }, [preferredLogoSrc]);
  const { setNodeRef: setLeftPanelDropRef } = useDroppable({ id: 'left-panel' });
  const [activeNav, setActiveNav] = useState('launcher');
  const [rankingSubTab, setRankingSubTab] = useState<'apps' | 'users'>('apps');
  const [appRankings, setAppRankings] = useState<ShellAppRankingItem[]>([]);
  const [userRankings, setUserRankings] = useState<ShellUserRankingItem[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingLoadFailed, setRankingLoadFailed] = useState(false);
  const [myappSubTab, setMyappSubTab] = useState<'favorites' | 'myapps'>('myapps');
  const [noticeSubTab, setNoticeSubTab] = useState<'notices' | 'updates'>('notices');
  const [noticeBoardItems, setNoticeBoardItems] = useState<{
    notices: LeftPanelNoticeItem[];
    updates: LeftPanelNoticeItem[];
  }>({ notices: [], updates: [] });
  const [noticeBoardLoading, setNoticeBoardLoading] = useState(true);
  const isOpen = leftOffset >= 0;
  /** 데스크톱 20px / 오버레이 기본 10px / ±480px 이하 flush 시 0 */
  const panelEdge = !isOverlay ? MOA_HOME_EDGE : overlayFlushEdges ? 0 : MOA_HOME_OVERLAY_EDGE;
  const tapToAdd = isOverlay && editMode;
  const panelScrollRef = useRef<HTMLDivElement>(null);
  const panelScrollHandlers = useMoaPanelScrollDrag(panelScrollRef, { disabled: editMode });
  const hasOwnedGeneratedApps = createdApps.some(app => app.id !== createAppShellMetadata.id);

  const filteredApps = activeTab === 'user'
    ? [
        ...APPS.filter(a => a.category === 'user'),
        ...sharedApps.filter(app => !APPS.some(baseApp => baseApp.id === app.id)),
      ]
    : APPS.filter(a => a.category === 'basic');

  const rankingLibraryApps = useMemo(
    () => [...APPS, ...createdApps, ...sharedApps],
    [createdApps, sharedApps],
  );

  /** 앱순위 — 좌측 공개 앱 카탈로그(기본+공유 생성앱)에 없는 id는 표시하지 않음 */
  const visibleAppRankings = useMemo(() => {
    const allowedIds = new Set(rankingLibraryApps.map(app => app.id));
    return appRankings.filter(item => allowedIds.has(item.app_id));
  }, [appRankings, rankingLibraryApps]);

  const rankingAbortRef = useRef<AbortController | null>(null);
  const noticeReloadRef = useRef<((_detail?: ShellNoticeBoardChangedDetail) => void) | null>(null);
  const activeNavRef = useRef(activeNav);
  const noticePreviewStaleRef = useRef(false);

  activeNavRef.current = activeNav;

  const reloadRankings = useCallback(() => {
    rankingAbortRef.current?.abort();
    const controller = new AbortController();
    rankingAbortRef.current = controller;

    void (async () => {
      try {
        setRankingLoading(true);
        setRankingLoadFailed(false);
        const [appsPayload, usersPayload] = await Promise.all([
          fetchShellAppRankings(30),
          fetchShellUserRankings(30),
        ]);

        if (controller.signal.aborted) {
          return;
        }

        setAppRankings(appsPayload.items);
        setUserRankings(usersPayload.items);
      } catch {
        if (!controller.signal.aborted) {
          setAppRankings([]);
          setUserRankings([]);
          setRankingLoadFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setRankingLoading(false);
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (activeNav !== 'economy') {
      return;
    }

    deferShellTertiaryWork(() => {
      reloadRankings();
    }, 120);

    return () => {
      rankingAbortRef.current?.abort();
    };
  }, [activeNav, reloadRankings]);

  const reloadNoticeBoard = useCallback(() => {
    noticeReloadRef.current?.();
  }, []);

  useEffect(() => {
    return subscribeShellNoticeBoardChanged(() => {
      if (activeNavRef.current === 'notice') {
        noticeReloadRef.current?.();
        return;
      }
      noticePreviewStaleRef.current = true;
    });
  }, []);

  useEffect(() => {
    if (activeNav !== 'notice') {
      noticeReloadRef.current = null;
      return;
    }

    deferShellTertiaryWork(() => {
      prefetchBoardWindowLayouts(MOA_SHELL_NOTICE_BOARD_SLUG);
    }, 0);

    let controller = new AbortController();
    let requestId = 0;

    async function loadNoticeBoardItems(signal: AbortSignal): Promise<void> {
      const currentRequest = ++requestId;
      try {
        setNoticeBoardLoading(true);
        const items = await fetchShellNoticeBoardPreview(signal);

        if (!signal.aborted && currentRequest === requestId) {
          setNoticeBoardItems(items);
        }
      } catch {
        if (!signal.aborted && currentRequest === requestId) {
          setNoticeBoardItems({ notices: [], updates: [] });
        }
      } finally {
        if (!signal.aborted && currentRequest === requestId) {
          setNoticeBoardLoading(false);
        }
      }
    }

    const reload = (_detail?: ShellNoticeBoardChangedDetail) => {
      controller.abort();
      controller = new AbortController();
      const signal = controller.signal;
      deferShellSecondaryWork(() => loadNoticeBoardItems(signal), 120);
    };

    noticeReloadRef.current = reload;
    if (noticePreviewStaleRef.current) {
      noticePreviewStaleRef.current = false;
    }
    reload();

    return () => {
      noticeReloadRef.current = null;
      controller.abort();
    };
  }, [activeNav]);

  const settledLauncherTab = useShellSubTabSettle(activeTab);
  const settledRankingSubTab = useShellSubTabSettle(rankingSubTab);
  const settledMyappSubTab = useShellSubTabSettle(myappSubTab);
  const settledNoticeSubTab = useShellSubTabSettle(noticeSubTab);

  const handleLauncherSubTabChange = useShellSubTabSelect(activeTab, settledLauncherTab, onTabChange);
  const handleRankingSubTabChange = useShellSubTabSelect(
    rankingSubTab,
    settledRankingSubTab,
    setRankingSubTab,
    () => reloadRankings(),
  );
  const handleMyappSubTabChange = useShellSubTabSelect(myappSubTab, settledMyappSubTab, setMyappSubTab);
  const handleNoticeSubTabChange = useShellSubTabSelect(
    noticeSubTab,
    settledNoticeSubTab,
    setNoticeSubTab,
    () => reloadNoticeBoard(),
  );

  const handleNavChange = useCallback((navId: string) => {
    if (navId === activeNav) {
      return;
    }
    setActiveNav(navId);
  }, [activeNav]);

  const noticeItems = noticeSubTab === 'updates' ? noticeBoardItems.updates : noticeBoardItems.notices;

  /** 현재 activeNav에 따른 서브탭 설정 */
  const getSubTabConfig = () => {
    switch (activeNav) {
      case 'launcher':
        return {
          tabs: [{ id: 'basic', label: t('moa_shell.left.tabs_basic_apps') }, { id: 'user', label: t('moa_shell.left.tabs_user_apps') }],
          activeTab: activeTab,
          onTabChange: handleLauncherSubTabChange,
        };
      case 'economy':
        return {
          tabs: [{ id: 'apps', label: t('moa_shell.left.tabs_rank_apps') }, { id: 'users', label: t('moa_shell.left.tabs_rank_users') }],
          activeTab: rankingSubTab,
          onTabChange: handleRankingSubTabChange,
        };
      case 'myapp':
        return {
          tabs: [{ id: 'myapps', label: t('moa_shell.left.tabs_my_apps') }, { id: 'favorites', label: t('moa_shell.left.tabs_favorites') }],
          activeTab: myappSubTab,
          onTabChange: handleMyappSubTabChange,
        };
      case 'notice':
        return {
          tabs: [{ id: 'notices', label: t('moa_shell.left.tabs_notices') }, { id: 'updates', label: t('moa_shell.left.tabs_updates') }],
          activeTab: noticeSubTab,
          onTabChange: handleNoticeSubTabChange,
        };
      default:
        return null;
    }
  };

  const subTabConfig = getSubTabConfig();

  return (
    <>
    <GlassPanel
      ref={setLeftPanelDropRef}
      className={`${isOverlay ? 'moa-mobile-overlay-panel fixed moa-home-shell-overlay-inset-y' : 'absolute moa-home-shell-inset-y'}`}
      style={{
        width: `${width}px`,
        left: `${panelEdge}px`,
        zIndex: isOverlay ? 80 : 10,
        /** `overlayFlushEdges`: 좌측 끝 직각·우측만 라운드 / 그 외 전면 24px */
        borderRadius: !isOverlay ? '24px' : overlayFlushEdges ? '0 24px 24px 0' : '24px',
        transform: isOpen ? 'translate3d(0, 0, 0)' : 'translate3d(-120%, 0, 0)',
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? undefined : 'none',
      }}
    >
      {/* 로고 */}
      <Div className="glass p-6 shrink-0 flex flex-col items-center gap-2 rounded-2xl relative">
        <Img
          key={logoSrc}
          src={logoSrc}
          alt="SMARTCARE"
          className="h-8 mb-2 object-contain cursor-pointer"
          onClick={() => (window.location.href = '/')}
          onError={() => {
            setLogoSrc(prev => resolveMoabomSiteLogoImgRecoveryUrl(prev, isDark ? 'dark' : 'light'));
          }}
        />
        <Div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--moa-point-color) 8%, transparent)' }}>
          <Icon name="bolt" className="text-xs" style={{ color: 'var(--moa-point-color)' }} />
          <Span className="text-xs font-bold" style={{ color: 'var(--moa-point-color)' }}>{t('moa_shell.left.creator_badge', { level: 1 })}</Span>
        </Div>
      </Div>

      {/* 메인 패널: 상/하단 슬롯은 고정, 본문만 스크롤 */}
      <Div className="relative min-h-0 flex-1">
        <Div
          ref={panelScrollRef}
          className="moa-panel-scroll absolute inset-0 overflow-y-auto px-3 scrollbar-hide"
          style={{
            paddingTop: `${MOABOM_SHELL_SUB_TAB_SLOT_PX}px`,
            paddingBottom: `${MOABOM_SHELL_LEFT_PANEL_BOTTOM_SLOT_PX}px`,
          }}
          {...panelScrollHandlers}
        >
          {/* 라이브러리 탭 - 앱 그리드 */}
          {activeNav === 'launcher' && (
            <Div className="py-1">
              {filteredApps.length > 0 ? (
                <LeftPanelAppGrid
                  apps={filteredApps}
                  editMode={editMode}
                  onEnterEditMode={onEnterEditMode}
                  onOpenApp={onOpenApp}
                  onAddApp={onAddApp}
                  tapToAdd={tapToAdd}
                />
              ) : (
                <Moa_PanelEmptyState
                  icon={activeTab === 'user' ? 'users' : 'cube'}
                  message={t(activeTab === 'user' ? 'moa_shell.left.empty_user_apps' : 'moa_shell.left.empty_basic_apps')}
                />
              )}
            </Div>
          )}

          {/* 랭킹 탭 */}
          {activeNav === 'economy' && (
            <Div className="py-1">
              {rankingSubTab === 'apps' && (
                rankingLoading ? (
                  <Moa_PanelLoadingState label={t('moa_shell.left.rankings_loading')} />
                ) : rankingLoadFailed ? (
                  <Moa_PanelEmptyState
                    icon="triangle-exclamation"
                    message={t('moa_shell.left.rankings_load_failed')}
                  />
                ) : visibleAppRankings.length > 0 ? (
                  <Div className="flex flex-col gap-1">
                    {visibleAppRankings.map(item => {
                      const rankApp = resolveRankingApp(item.app_id, rankingLibraryApps);
                      return (
                      <Div
                        key={`rank-app-${item.app_id}`}
                        className="group flex items-center gap-2 py-2 rounded-xl hover:opacity-90 transition-all cursor-pointer"
                      >
                        <Span className={`w-6 text-center font-bold ${
                          item.rank <= 3
                            ? item.rank === 1 ? 'text-yellow-500 text-lg' : item.rank === 2 ? 'text-gray-400 text-lg' : 'text-amber-600 text-lg'
                            : 'text-muted text-sm'
                        }`}>
                          {item.rank <= 3 ? <Icon name="trophy" /> : item.rank}
                        </Span>
                        <LeftPanelAppIcon
                          app={rankApp}
                          editMode={editMode}
                          onEnterEditMode={onEnterEditMode}
                          onOpenApp={onOpenApp}
                          onAddApp={onAddApp}
                          tapToAdd={tapToAdd}
                          iconSize="w-10 h-10 rounded-xl"
                          iconTextSize="text-sm"
                          showName={false}
                          fullWidth={false}
                        />
                        <Div className="flex-1 min-w-0">
                          <RankingAppTexts app={rankApp} emptyDescriptionFallback={t('moa_shell.common.app_description_fallback')} />
                        </Div>
                        <Span className={`text-xs font-bold ${
                          item.change === 'up' ? 'text-green-500' : item.change === 'down' ? 'text-red-500' : 'text-muted'
                        }`}>
                          {item.change === 'up' ? <Icon name="caret-up" /> : item.change === 'down' ? <Icon name="caret-down" /> : '-'}
                        </Span>
                      </Div>
                      );
                    })}
                  </Div>
                ) : (
                  <Moa_PanelEmptyState
                    icon="trophy"
                    message={t('moa_shell.left.rankings_apps_empty')}
                  />
                )
              )}
              {rankingSubTab === 'users' && (
                rankingLoading ? (
                  <Moa_PanelLoadingState label={t('moa_shell.left.rankings_loading')} />
                ) : rankingLoadFailed ? (
                  <Moa_PanelEmptyState
                    icon="triangle-exclamation"
                    message={t('moa_shell.left.rankings_load_failed')}
                  />
                ) : userRankings.length > 0 ? (
                  <Div className="flex flex-col gap-1">
                    {userRankings.map(user => (
                      <Div
                        key={`rank-user-${user.user_id}`}
                        className="flex items-center gap-2 py-2 rounded-xl hover:opacity-90 transition-all cursor-pointer"
                        onClick={() => {
                          if (user.user_uuid) {
                            onOpenUserProfile?.(user.user_uuid, user.name);
                          }
                        }}
                      >
                        <Span className={`w-6 text-center font-bold ${
                          user.rank <= 3
                            ? user.rank === 1 ? 'text-yellow-500 text-lg' : user.rank === 2 ? 'text-gray-400 text-lg' : 'text-amber-600 text-lg'
                            : 'text-muted text-sm'
                        }`}>
                          {user.rank <= 3 ? <Icon name="crown" /> : user.rank}
                        </Span>
                        <Div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md"
                          style={{ background: shellRankingAvatarGradient(user.name) }}
                        >
                          {shellRankingAvatarLabel(user.name)}
                        </Div>
                        <Div className="flex-1 min-w-0">
                          <Span className="font-bold text-primary text-sm block truncate">{user.name}</Span>
                          <Span className="text-xs text-muted block">
                            {t('moa_shell.left.rankings_activity_score', { score: user.score.toLocaleString() })}
                          </Span>
                        </Div>
                        <Span className={`text-xs font-bold ${
                          user.change === 'up' ? 'text-green-500' : user.change === 'down' ? 'text-red-500' : 'text-muted'
                        }`}>
                          {user.change === 'up' ? <Icon name="caret-up" /> : user.change === 'down' ? <Icon name="caret-down" /> : '-'}
                        </Span>
                      </Div>
                    ))}
                  </Div>
                ) : (
                  <Moa_PanelEmptyState
                    icon="users"
                    message={t('moa_shell.left.rankings_users_empty')}
                  />
                )
              )}
            </Div>
          )}

          {/* 마이앱 탭 */}
          {activeNav === 'myapp' && (
            <Div className="py-1">
              {myappSubTab === 'myapps' && (
                <Div>
                  {ownedGeneratedAppsLoading && !hasOwnedGeneratedApps ? (
                    <Moa_PanelLoadingState label={t('moa_shell.left.myapps_loading')} />
                  ) : createdApps.length > 0 ? (
                    <LeftPanelAppGrid
                      apps={createdApps}
                      editMode={editMode}
                      onEnterEditMode={onEnterEditMode}
                      onOpenApp={onOpenApp}
                      onAddApp={onAddApp}
                      tapToAdd={tapToAdd}
                    />
                  ) : (
                    <Moa_PanelEmptyState
                      icon="cube"
                      message={t('moa_shell.left.empty_myapps')}
                    />
                  )}
                </Div>
              )}
              {myappSubTab === 'favorites' && (
                <Div>
                  {favoriteApps.length > 0 ? (
                    <LeftPanelAppGrid
                      apps={favoriteApps}
                      editMode={editMode}
                      onEnterEditMode={onEnterEditMode}
                      onOpenApp={onOpenApp}
                      onAddApp={onAddApp}
                      tapToAdd={tapToAdd}
                    />
                  ) : (
                    <Moa_PanelEmptyState
                      icon="star"
                      message={t('moa_shell.left.empty_favorites')}
                    />
                  )}
                </Div>
              )}
            </Div>
          )}

          {/* 공지 탭 */}
          {activeNav === 'notice' && (
            <Div className="py-1">
              {noticeBoardLoading ? (
                <Moa_PanelLoadingState label={t('moa_shell.left.notice_loading')} />
              ) : noticeItems.length > 0 ? (
                <Div className="flex flex-col gap-1">
                  {noticeItems.map((notice, index) => (
                    <Div
                      key={notice.id}
                      role="button"
                      tabIndex={0}
                      className="py-2 rounded-xl hover:opacity-90 transition-all cursor-pointer"
                      onClick={() => openShellNoticeBoard(onOpenBoard, notice)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openShellNoticeBoard(onOpenBoard, notice);
                        }
                      }}
                    >
                      <Div className="flex items-start gap-2">
                        <Div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-slate-100 dark:bg-slate-800/55">
                          <Span className="text-sm font-bold text-primary leading-none tabular-nums">
                            {index + 1}
                          </Span>
                        </Div>
                        <Div className="flex-1 min-w-0">
                          <Div className="flex items-center gap-1.5">
                            {notice.badges.map(badge => (
                              <Span
                                key={`${notice.id}-${badge}`}
                                className={`text-xxs px-1.5 py-0.5 rounded font-bold ${getNoticeBadgeClassName(badge)}`}
                                style={badge === 'update' ? { background: 'var(--moa-point-color)' } : undefined}
                              >
                                {t(`moa_shell.common.badge_${badge}`)}
                              </Span>
                            ))}
                            <Span className="font-bold text-primary text-sm truncate">{notice.title}</Span>
                          </Div>
                          <Div className="text-xs text-secondary mt-1 truncate">{notice.desc}</Div>
                          <Div className="text-xs text-muted mt-1">{notice.date}</Div>
                        </Div>
                      </Div>
                    </Div>
                  ))}
                </Div>
              ) : (
                <Moa_PanelEmptyState
                  icon={noticeSubTab === 'updates' ? 'sync' : 'bell'}
                  message={t(noticeSubTab === 'updates' ? 'moa_shell.left.empty_updates' : 'moa_shell.left.empty_notices')}
                />
              )}
            </Div>
          )}
        </Div>

        {/* 상단 서브탭 */}
        <Div className="absolute top-0 left-0 right-0 z-10 py-2">
          {subTabConfig && (
            <SubTabBar
              tabs={subTabConfig.tabs}
              activeTab={subTabConfig.activeTab}
              onTabChange={subTabConfig.onTabChange}
            />
          )}
        </Div>

        {/* 하단 네비 */}
        <Div className="absolute bottom-0 left-0 right-0 z-10 rounded-2xl">
          <Div className="glass-sm-blur p-1.5 rounded-2xl">
            <Div className="relative">
              {/* 이동하는 배경 */}
              <Div
                className="absolute bg-white dark:bg-white/15 rounded-xl transition-all duration-300 ease-out"
                style={{
                  left: `calc(${NAV_ITEMS.findIndex(n => n.id === activeNav)} * 25%)`,
                  top: 0,
                  bottom: 0,
                  width: '25%',
                }}
              >
                <Div className="w-full h-full glass-sm rounded-xl" />
              </Div>
              <Div className="grid grid-cols-4 relative z-10">
                {NAV_ITEMS.map(nav => (
                  <Button
                    key={nav.id}
                    onClick={() => handleNavChange(nav.id)}
                    className={`flex flex-col items-center gap-1 py-2 border-0 transition-colors duration-200 cursor-pointer ${
                      activeNav === nav.id
                        ? isDark
                          ? 'text-primary'
                          : ''
                        : 'text-muted hover:text-muted'
                    }`}
                    style={
                      activeNav === nav.id && !isDark
                        ? { color: 'var(--moa-point-color)' }
                        : undefined
                    }
                  >
                    <Icon name={nav.icon} className="text-base" />
                    <Span className="text-xs font-bold leading-none">{t(`moa_shell.nav.${nav.id}`)}</Span>
                  </Button>
                ))}
              </Div>
            </Div>
          </Div>
        </Div>
      </Div>
    </GlassPanel>
    {isOverlay && isOpen && (
      <Button
        onClick={onClose}
        className="moa-panel-outside-close moa-panel-outside-close-left"
        style={{ left: `${panelEdge + width + 8}px` }}
        aria-label={t('moa_shell.left.close_panel')}
      >
        <Icon name="times" className="text-white text-sm drop-shadow" />
      </Button>
    )}
    </>
  );
};
