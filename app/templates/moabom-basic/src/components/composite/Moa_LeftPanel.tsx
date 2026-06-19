import React, { useEffect, useState } from 'react';
import { useMoabomDarkMode } from '../../hooks/useMoabomDarkMode';
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
import { APPS, type App } from '../../data/Moa_apps';
import { NAV_ITEMS } from '../../data/Moa_navigation';
import { RANKING_DATA } from '../../data/Moa_mockData';
import {
  MOA_SHELL_NOTICE_BOARD_SLUG,
  openShellNoticeBoard,
} from '../../shell/moaShellNoticeBoard';
import { useResolvedAppStrings } from '../../i18n/useResolvedAppStrings';
import { MOABOM_SHELL_SUB_TAB_SLOT_PX } from '../../layout/moabomShellPanelLayout';
import { useMoabomSiteLogoUrls } from '../../utils/moabomSiteBranding';

/** 메인 좌측 패널 하단 고정 네비 슬롯 높이 */
const NAV_H = 78;

type BoardNoticePreview = {
  id?: number | string;
  title?: string | null;
  content_preview?: string | null;
  created_at_formatted?: string | null;
  created_at?: string | null;
  category?: string | null;
  is_notice?: boolean;
  is_new?: boolean;
  view_count?: number;
  row_type?: string | null;
};

type NoticeBadgeKind = 'new' | 'popular' | 'notice' | 'update';

type LeftPanelNoticeItem = {
  id: string;
  title: string;
  desc: string;
  date: string;
  category: '공지사항' | '업데이트';
  boardSlug: string;
  postId: string;
  badges: NoticeBadgeKind[];
};

const NOTICE_BOARD_CATEGORIES = {
  notices: '공지사항',
  updates: '업데이트',
} as const;

const POPULAR_NOTICE_VIEW_THRESHOLD = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractBoardNoticePreviews(payload: unknown): BoardNoticePreview[] {
  const body = isRecord(payload) && 'data' in payload ? payload.data : payload;
  const data = isRecord(body) && Array.isArray(body.data) ? body.data : Array.isArray(body) ? body : [];

  return data.filter(isRecord).map(item => item as BoardNoticePreview);
}

function createNoticeBadges(post: BoardNoticePreview, category: LeftPanelNoticeItem['category']): NoticeBadgeKind[] {
  const badges: NoticeBadgeKind[] = [];
  if (post.is_new) {
    badges.push('new');
  }
  if (Number(post.view_count ?? 0) >= POPULAR_NOTICE_VIEW_THRESHOLD) {
    badges.push('popular');
  }
  if (post.is_notice || post.row_type === 'notice') {
    badges.push('notice');
  }
  if (category === NOTICE_BOARD_CATEGORIES.updates) {
    badges.push('update');
  }

  return badges;
}

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

function toLiveNoticeItem(
  post: BoardNoticePreview,
  category: LeftPanelNoticeItem['category'],
): LeftPanelNoticeItem | null {
  if (post.id == null || !post.title) {
    return null;
  }
  if (post.category !== category) {
    return null;
  }

  const badges = createNoticeBadges(post, category);

  return {
    id: `live-${category}-${post.id}`,
    title: post.title,
    desc: post.content_preview?.trim() || `${category} 게시글`,
    date: post.created_at_formatted ?? post.created_at ?? '',
    category,
    boardSlug: MOA_SHELL_NOTICE_BOARD_SLUG,
    postId: String(post.id),
    badges,
  };
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
function toApp(item: { id: string; name: string; icon: string; gradient: string; category?: string }): App {
  return {
    id: item.id,
    name: item.name,
    description: '',
    icon: item.icon,
    gradient: item.gradient,
    category: (item.category as 'basic' | 'user') ?? 'basic',
    source: 'system',
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
  sharedApps = [],
  isOverlay = false,
  overlayFlushEdges = false,
  onClose,
  onOpenBoard,
}) => {
  const isDark = useMoabomDarkMode();
  const { t } = useMoabomShellT();
  const { lightUrl: logoImageLight, darkUrl: logoImageDark } = useMoabomSiteLogoUrls();
  const { setNodeRef: setLeftPanelDropRef } = useDroppable({ id: 'left-panel' });
  const [activeNav, setActiveNav] = useState('launcher');
  const [rankingSubTab, setRankingSubTab] = useState<'apps' | 'users'>('apps');
  const [myappSubTab, setMyappSubTab] = useState<'favorites' | 'myapps'>('favorites');
  const [noticeSubTab, setNoticeSubTab] = useState<'notices' | 'updates'>('notices');
  const [noticeBoardItems, setNoticeBoardItems] = useState<{
    notices: LeftPanelNoticeItem[];
    updates: LeftPanelNoticeItem[];
  }>({ notices: [], updates: [] });
  const [noticeBoardLoading, setNoticeBoardLoading] = useState(true);
  const isOpen = leftOffset >= 0;
  /** 데스크톱 20px / 오버레이 기본 10px / ±480px 이하 flush 시 0 */
  const panelEdge = !isOverlay ? 20 : overlayFlushEdges ? 0 : 10;
  const tapToAdd = isOverlay && editMode;

  const filteredApps = activeTab === 'user'
    ? [
        ...APPS.filter(a => a.category === 'user'),
        ...sharedApps.filter(app => !APPS.some(baseApp => baseApp.id === app.id)),
      ]
    : APPS.filter(a => a.category === 'basic');

  useEffect(() => {
    const controller = new AbortController();

    async function loadByCategory(category: LeftPanelNoticeItem['category']): Promise<LeftPanelNoticeItem[]> {
      const params = new URLSearchParams({
        page: '1',
        per_page: '5',
        category,
      });
      const response = await fetch(
        `/api/modules/sirsoft-board/boards/${encodeURIComponent(MOA_SHELL_NOTICE_BOARD_SLUG)}/posts?${params.toString()}`,
        {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        return [];
      }

      const payload: unknown = await response.json();
      return extractBoardNoticePreviews(payload)
        .map(post => toLiveNoticeItem(post, category))
        .filter((item): item is LeftPanelNoticeItem => item !== null);
    }

    async function loadNoticeBoardItems(): Promise<void> {
      try {
        setNoticeBoardLoading(true);
        const [notices, updates] = await Promise.all([
          loadByCategory(NOTICE_BOARD_CATEGORIES.notices),
          loadByCategory(NOTICE_BOARD_CATEGORIES.updates),
        ]);

        if (!controller.signal.aborted) {
          setNoticeBoardItems({ notices, updates });
        }
      } catch {
        if (!controller.signal.aborted) {
          setNoticeBoardItems({ notices: [], updates: [] });
        }
      } finally {
        if (!controller.signal.aborted) {
          setNoticeBoardLoading(false);
        }
      }
    }

    void loadNoticeBoardItems();

    return () => controller.abort();
  }, []);

  const noticeItems = noticeSubTab === 'updates' ? noticeBoardItems.updates : noticeBoardItems.notices;

  /** 현재 activeNav에 따른 서브탭 설정 */
  const getSubTabConfig = () => {
    switch (activeNav) {
      case 'launcher':
        return {
          tabs: [{ id: 'basic', label: t('moa_shell.left.tabs_basic_apps') }, { id: 'user', label: t('moa_shell.left.tabs_user_apps') }],
          activeTab: activeTab,
          onTabChange: (id: string) => onTabChange(id as 'basic' | 'user'),
        };
      case 'economy':
        return {
          tabs: [{ id: 'apps', label: t('moa_shell.left.tabs_rank_apps') }, { id: 'users', label: t('moa_shell.left.tabs_rank_users') }],
          activeTab: rankingSubTab,
          onTabChange: (id: string) => setRankingSubTab(id as 'apps' | 'users'),
        };
      case 'myapp':
        return {
          tabs: [{ id: 'favorites', label: t('moa_shell.left.tabs_favorites') }, { id: 'myapps', label: t('moa_shell.left.tabs_my_apps') }],
          activeTab: myappSubTab,
          onTabChange: (id: string) => setMyappSubTab(id as 'favorites' | 'myapps'),
        };
      case 'notice':
        return {
          tabs: [{ id: 'notices', label: t('moa_shell.left.tabs_notices') }, { id: 'updates', label: t('moa_shell.left.tabs_updates') }],
          activeTab: noticeSubTab,
          onTabChange: (id: string) => setNoticeSubTab(id as 'notices' | 'updates'),
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
      className={`${isOverlay ? 'moa-mobile-overlay-panel fixed top-2.5 bottom-2.5' : 'absolute top-5 bottom-5'}`}
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
          src={isDark ? logoImageDark : logoImageLight}
          alt="SMARTCARE"
          className="h-8 mb-2 object-contain cursor-pointer"
          onClick={() => (window.location.href = '/')}
        />
        <Div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--moa-point-color) 8%, transparent)' }}>
          <Icon name="bolt" className="text-xs" style={{ color: 'var(--moa-point-color)' }} />
          <Span className="text-xs font-bold" style={{ color: 'var(--moa-point-color)' }}>{t('moa_shell.left.creator_badge', { level: 1 })}</Span>
        </Div>
      </Div>

      {/* 메인 패널: 상/하단 슬롯은 고정, 본문만 스크롤 */}
      <Div className="relative min-h-0 flex-1">
        <Div
          className="absolute inset-0 overflow-y-auto px-3"
          style={{ paddingTop: `${MOABOM_SHELL_SUB_TAB_SLOT_PX}px`, paddingBottom: `${NAV_H}px` }}
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
                <Div className="text-center py-8 text-muted">
                  <Icon
                    name={activeTab === 'user' ? 'users' : 'cube'}
                    className="text-3xl mb-2 opacity-30"
                  />
                  <Div className="text-sm">
                    {t(activeTab === 'user' ? 'moa_shell.left.empty_user_apps' : 'moa_shell.left.empty_basic_apps')}
                  </Div>
                </Div>
              )}
            </Div>
          )}

          {/* 랭킹 탭 */}
          {activeNav === 'economy' && (
            <Div className="py-1">
              {rankingSubTab === 'apps' && (
                <Div className="flex flex-col gap-1">
                  {RANKING_DATA.apps.map(item => {
                    const rankApp = APPS.find(a => a.id === item.id) ?? toApp(item);
                    return (
                    <Div
                      key={`rank-app-${item.id}`}
                      className="group flex items-center gap-2 py-2 rounded-xl hover:opacity-90 transition-all cursor-pointer"
                    >
                      <Span className={`w-6 text-center font-bold ${
                        item.rank <= 3
                          ? item.rank === 1 ? 'text-yellow-500 text-lg' : item.rank === 2 ? 'text-gray-400 text-lg' : 'text-amber-600 text-lg'
                          : 'text-muted text-sm'
                      }`}>
                        {item.rank <= 3 ? <Icon name="trophy" /> : item.rank}
                      </Span>
                      {/* 아이콘만 드래그 가능 + 롱프레스 */}
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
              )}
              {rankingSubTab === 'users' && (
                <Div className="flex flex-col gap-1">
                  {RANKING_DATA.users.map(user => (
                    <Div key={`rank-user-${user.rank}-${user.name}`} className="flex items-center gap-2 py-2 rounded-xl hover:opacity-90 transition-all cursor-pointer">
                      <Span className={`w-6 text-center font-bold ${
                        user.rank <= 3
                          ? user.rank === 1 ? 'text-yellow-500 text-lg' : user.rank === 2 ? 'text-gray-400 text-lg' : 'text-amber-600 text-lg'
                          : 'text-muted text-sm'
                      }`}>
                        {user.rank <= 3 ? <Icon name="crown" /> : user.rank}
                      </Span>
                      <Div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md" style={{ background: user.color }}>
                        {user.avatar}
                      </Div>
                      <Div className="flex-1 min-w-0">
                        <Span className="font-bold text-primary text-sm block truncate">{user.name}</Span>
                        <Span className="text-xs text-muted block">{user.point.toLocaleString()} P</Span>
                      </Div>
                      <Span className={`text-xs font-bold ${
                        user.change === 'up' ? 'text-green-500' : user.change === 'down' ? 'text-red-500' : 'text-muted'
                      }`}>
                        {user.change === 'up' ? <Icon name="caret-up" /> : user.change === 'down' ? <Icon name="caret-down" /> : '-'}
                      </Span>
                    </Div>
                  ))}
                </Div>
              )}
            </Div>
          )}

          {/* 마이앱 탭 */}
          {activeNav === 'myapp' && (
            <Div className="py-1">
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
                    <Div className="text-center py-8 text-muted">
                      <Icon name="star" className="text-3xl mb-2 opacity-30" />
                      <Div className="text-sm">{t('moa_shell.left.empty_favorites')}</Div>
                    </Div>
                  )}
                </Div>
              )}
              {myappSubTab === 'myapps' && (
                <Div>
                  {createdApps.length > 0 ? (
                    <LeftPanelAppGrid
                      apps={createdApps}
                      editMode={editMode}
                      onEnterEditMode={onEnterEditMode}
                      onOpenApp={onOpenApp}
                      onAddApp={onAddApp}
                      tapToAdd={tapToAdd}
                    />
                  ) : (
                    <Div className="text-center py-8 text-muted">
                      <Icon name="cube" className="text-3xl mb-2 opacity-30" />
                      <Div className="text-sm">{t('moa_shell.left.empty_myapps')}</Div>
                    </Div>
                  )}
                </Div>
              )}
            </Div>
          )}

          {/* 공지 탭 */}
          {activeNav === 'notice' && (
            <Div className="py-1">
              {noticeBoardLoading ? (
                <Div className="text-center py-8 text-muted">
                  <Icon name="spinner" className="text-2xl mb-2 opacity-40" />
                  <Div className="text-sm">{t('moa_shell.left.notice_loading')}</Div>
                </Div>
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
                <Div className="text-center py-8 text-muted">
                  <Icon name={noticeSubTab === 'updates' ? 'sync' : 'bell'} className="text-3xl mb-2 opacity-30" />
                  <Div className="text-sm">
                    {t(noticeSubTab === 'updates' ? 'moa_shell.left.empty_updates' : 'moa_shell.left.empty_notices')}
                  </Div>
                </Div>
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
          <Div className="glass-sm-blur p-2 rounded-2xl">
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
                    onClick={() => setActiveNav(nav.id)}
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
