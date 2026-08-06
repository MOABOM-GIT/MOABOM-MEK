import React, { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Window } from '../../components/composite/Moa_Window';
import { Moa_LiquidGlassFilters } from '../../components/composite/Moa_LiquidGlassFilters';
import { LeftPanel } from '../../components/composite/Moa_LeftPanel';
import { CenterPanel, type WindowState } from '../../components/composite/Moa_CenterPanel';
import { RightPanel } from '../../components/composite/Moa_RightPanel';
import Toast, { type ToastItem } from '../../components/composite/Toast';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import type { App } from '../../data/Moa_apps';
import {
  brandedAppIconClassName,
  brandedTitleBarVariant,
  brandedTitleGradientClassName,
  getBrandedShellCssVars,
  isBrandedShellAppId,
} from '../../apps/brandedShellChrome';
import { resolveAppStrings } from '../../i18n/resolveAppStrings';
import type { MoabomTranslateFn } from '../../i18n/moabomT';
import { moabomBackgroundImageCssValue } from '../../utils/moBackgroundAssets';
import {
  isMoaShellLegalPageAppId,
} from '../../shell/moaShellLegalPageIds';
import {
  isMoaShellBoardAppId,
} from '../../shell/moaShellBoardIds';
import { isMoaShellUserProfileAppId } from '../../shell/moaShellUserProfileIds';
import {
  isMoaShellErrorAppId,
} from '../../shell/moaShellErrorIds';
import { isMoaShellAppCommunityAppId } from '../../shell/moaShellAppCommunityIds';
import { resolveShellWindowChrome } from '../../shell/resolveShellWindowChrome';
import { Moa_ShellWindowRenderer } from './Moa_ShellWindowRenderer';
import {
  AUTH_WINDOW_APP_IDS,
  AUTH_WINDOW_HEIGHT,
  AUTH_WINDOW_WIDTH,
  BOARD_WINDOW_HEIGHT,
  BOARD_WINDOW_WIDTH,
  USER_PROFILE_WINDOW_HEIGHT,
  USER_PROFILE_WINDOW_WIDTH,
  BREAKPOINT_COMPACT_CONTROLS,
  BREAKPOINT_FULLSCREEN_WINDOW,
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  ERROR_WINDOW_HEIGHT,
  ERROR_WINDOW_WIDTH,
  APP_COMMUNITY_WINDOW_HEIGHT,
  APP_COMMUNITY_WINDOW_WIDTH,
  LEGAL_PAGE_WINDOW_HEIGHT,
  LEGAL_PAGE_WINDOW_WIDTH,
} from '../../shell/moaShellLayoutConstants';
import { moaHomeShellCssVars } from './moaHomeShellCssVars';
import { Moa_WeatherEffectHost } from './Moa_WeatherEffectHost';
import { buildShellAuthStateKey } from '../../shell/moaShellAuthStateKey';
import { showAppEditToast } from '../../runtime/moaShellToasts';
import type { GeneratedLibraryHydration } from '../../apps/generatedAppLibraryAuthority';
import type { MoaCurrentUser, AuthUserLike } from '../../shell/moaShellTypes';
import type { MoabomSystemDefaults, MoabomSystemLanguage, MoabomSystemState } from '../../types/moabomSystem';
import type { EffectiveSystemOptions } from '../../runtime/types';
import { MoabomPresenceProvider } from '../../hooks/MoabomPresenceProvider';
import type { Dispatch, SetStateAction } from 'react';

export interface Moa_HomeShellViewProps {
  t: MoabomTranslateFn;
  language: MoabomSystemLanguage;
  systemState: MoabomSystemState;
  systemDefaults: MoabomSystemDefaults | null;
  setSystemState: Dispatch<SetStateAction<MoabomSystemState>>;
  setSystemDefaults: Dispatch<SetStateAction<MoabomSystemDefaults | null>>;
  editMode: boolean;
  toasts: ToastItem[];
  effectiveSystemOptions: EffectiveSystemOptions;
  viewportWidth: number;
  overlayActive: boolean;
  isMobileOverlay: boolean;
  isRightOverlay: boolean;
  overlayFlushEdges: boolean;
  overlayPanelWidth: number;
  leftOffset: number;
  rightOffset: number;
  centerLeft: number;
  centerRight: number;
  leftOpen: boolean;
  rightOpen: boolean;
  activeTab: 'basic' | 'user';
  modeIdx: number;
  mainApps: App[];
  mainAppsLoading: boolean;
  appsById: Map<string, App>;
  favoriteApps: App[];
  favoriteIdsRef: React.MutableRefObject<string[]>;
  createdApps: App[];
  libraryHydration: GeneratedLibraryHydration;
  sharedGeneratedApps: App[];
  leftPanelMyApps: App[];
  recentApps: App[];
  taskbarItems: WindowState[];
  windows: WindowState[];
  isLoggedIn: boolean;
  currentUser: MoaCurrentUser | null;
  setActiveTab: (tab: 'basic' | 'user') => void;
  setLeftOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRightOpen: React.Dispatch<React.SetStateAction<boolean>>;
  updateSystemState: (patch: import('../../types/moabomSystem').MoabomSystemStateMergePatch) => void;
  handleModeChange: (idx: number) => void;
  handleEnterEditMode: () => void;
  handleExitEditMode: () => void;
  handleDeleteApp: (appId: string) => void;
  handleAddAppToMain: (app: App) => void;
  addAppToMain: (app: App) => boolean;
  reorderMainApps: (apps: App[]) => void;
  mainAppsRef: React.MutableRefObject<App[]>;
  toggleFavoriteApp: (appId: string) => void;
  openApp: (app: App) => void;
  openMyPage: (tab?: import('../../components/composite/mypage/myPageTypes').MyPageTab) => void;
  openAuthWindow: (mode: import('../../components/composite/Moa_AuthWindowContent').AuthWindowMode) => void;
  openBoardWindow: (slug: string, postId?: string) => void;
  openUserProfileWindow: (userUuid: string, displayName?: string, view?: import('../../shell/userProfileWindowLayoutRuntime').UserProfileWindowView) => void;
  openShellSurface: (action: import('../../shell/shellSurfaceTypes').ShellSurfaceOpenAction, sync?: import('../../shell/shellSurfaceTypes').ShellUrlSyncOptions) => void;
  openLegalPage: (slug: import('../../shell/moaShellLegalPageIds').MoaShellLegalPageSlug) => void;
  restoreTaskbarWindow: (id: string) => void;
  closeWindow: (win: WindowState) => void;
  minimizeWindow: (id: string) => void;
  toggleMaximize: (id: string) => void;
  focusWindow: (id: string) => void;
  resolveWinTitle: (win: WindowState) => string;
  openEditGeneratedApp: (serverId: number) => void;
  deleteSavedGeneratedApp: (serverId: number, displayTitle?: string) => Promise<void>;
  toggleGeneratedAppShare: (serverId: number, nextShared: boolean) => Promise<void>;
  openAppCommunityWindow: (serverId: number, options?: { title?: string; canWrite?: boolean }) => void;
  handleShellAuthenticated: (user?: AuthUserLike | null) => void;
  handleShellProfileUpdated: (user?: AuthUserLike | null) => void;
  handleMyPageTabChange: (winId: string, tab: import('../../components/composite/mypage/myPageTypes').MyPageTab) => void;
  updateLegalPageWindowTitle: (windowId: string, title: string) => void;
  updateBoardWindowTitle: (windowId: string, title: string) => void;
  updateGeneratedAppWindowTitle: (windowId: string, title: string) => void;
  updateUserProfileWindowTitle: (windowId: string, title: string) => void;
  switchUserProfileWindowView: (windowId: string, view: import('../../shell/userProfileWindowLayoutRuntime').UserProfileWindowView) => void;
  updateErrorWindowTitle: (windowId: string, title: string) => void;
}

type RenderWindowContent = (win: WindowState) => React.ReactNode;

interface ShellWindowFrameProps {
  win: WindowState;
  title: string;
  icon: string;
  gradient: string;
  iconImageUrl?: string;
  isFavorite: boolean;
  isForeground: boolean;
  compactWindow: boolean;
  renderWindowContent: RenderWindowContent;
  onCloseWindow: (win: WindowState) => void;
  onMinimizeWindow: (id: string) => void;
  onToggleMaximize: (id: string) => void;
  onFocusWindow: (id: string) => void;
  onToggleFavoriteApp: (appId: string) => void;
}

const ShellWindowFrame: React.FC<ShellWindowFrameProps> = React.memo(({
  win,
  title,
  icon,
  gradient,
  iconImageUrl,
  isFavorite,
  isForeground,
  compactWindow,
  renderWindowContent,
  onCloseWindow,
  onMinimizeWindow,
  onToggleMaximize,
  onFocusWindow,
  onToggleFavoriteApp,
}) => {
  const isAuthWin = (AUTH_WINDOW_APP_IDS as readonly string[]).includes(win.appId);
  const isLegalPageWin = isMoaShellLegalPageAppId(win.appId);
  const isBoardWin = isMoaShellBoardAppId(win.appId);
  const isUserProfileWin = isMoaShellUserProfileAppId(win.appId);
  const isErrorWin = isMoaShellErrorAppId(win.appId);
  const isAppCommunityWin = isMoaShellAppCommunityAppId(win.appId);
  const isBrandedShellWin = isBrandedShellAppId(win.appId);
  const canToggleFavorite = !(
    isAuthWin
    || isLegalPageWin
    || isBoardWin
    || isUserProfileWin
    || isErrorWin
    || isAppCommunityWin
    || isBrandedShellWin
  );
  const titleBarExtraStyle = useMemo(
    () => getBrandedShellCssVars(win.appId),
    [win.appId],
  );
  const handleClose = useCallback(() => onCloseWindow(win), [onCloseWindow, win]);
  const handleMinimize = useCallback(() => onMinimizeWindow(win.id), [onMinimizeWindow, win.id]);
  const handleMaximize = useCallback(() => onToggleMaximize(win.id), [onToggleMaximize, win.id]);
  const handleFocus = useCallback(() => onFocusWindow(win.id), [onFocusWindow, win.id]);
  const handleToggleFavorite = useCallback(
    () => onToggleFavoriteApp(win.appId),
    [onToggleFavoriteApp, win.appId],
  );

  return (
    <Window
      id={win.id}
      title={title}
      icon={icon}
      iconImageUrl={iconImageUrl}
      gradient={gradient}
      zIndex={win.zIndex}
      isFavorite={isFavorite}
      initialX={isAuthWin ? undefined : win.initialX}
      initialY={isAuthWin ? undefined : win.initialY}
      isMaximized={win.isMaximized}
      isMinimized={win.isMinimized}
      preserveContentWhenMinimized={win.isMinimized}
      onClose={handleClose}
      onMinimize={handleMinimize}
      onMaximize={handleMaximize}
      onFocus={handleFocus}
      isForeground={isForeground}
      titleBarVariant={brandedTitleBarVariant(win.appId)}
      titleBarExtraStyle={titleBarExtraStyle}
      onToggleFavorite={canToggleFavorite ? handleToggleFavorite : undefined}
      compact={compactWindow}
      {...(isAuthWin
        ? {
            initialWidth: AUTH_WINDOW_WIDTH,
            initialHeight: AUTH_WINDOW_HEIGHT,
            minWidth: 360,
            minHeight: 260,
            fitContent: !compactWindow,
            fitContentWidth: 440,
            fitContentRemeasureKey: win.appId,
          }
        : isLegalPageWin
          ? {
              initialWidth: LEGAL_PAGE_WINDOW_WIDTH,
              initialHeight: LEGAL_PAGE_WINDOW_HEIGHT,
              minWidth: 360,
              minHeight: 280,
            }
          : isBoardWin
            ? {
                initialWidth: BOARD_WINDOW_WIDTH,
                initialHeight: BOARD_WINDOW_HEIGHT,
                minWidth: 360,
                minHeight: 320,
              }
            : isUserProfileWin
              ? {
                  initialWidth: USER_PROFILE_WINDOW_WIDTH,
                  initialHeight: USER_PROFILE_WINDOW_HEIGHT,
                  minWidth: 360,
                  minHeight: 320,
                }
              : isErrorWin
                ? {
                    initialWidth: ERROR_WINDOW_WIDTH,
                    initialHeight: ERROR_WINDOW_HEIGHT,
                    minWidth: 320,
                    minHeight: 240,
                  }
                : isAppCommunityWin
                  ? {
                      initialWidth: APP_COMMUNITY_WINDOW_WIDTH,
                      initialHeight: APP_COMMUNITY_WINDOW_HEIGHT,
                      minWidth: 360,
                      minHeight: 400,
                    }
                  : {
                      initialWidth: DEFAULT_WINDOW_WIDTH,
                      initialHeight: DEFAULT_WINDOW_HEIGHT,
                    })}
    >
      {renderWindowContent(win)}
    </Window>
  );
}, areShellWindowFramePropsEqual);

function areShellWindowFramePropsEqual(
  prev: ShellWindowFrameProps,
  next: ShellWindowFrameProps,
): boolean {
  return prev.win === next.win
    && prev.title === next.title
    && prev.icon === next.icon
    && prev.gradient === next.gradient
    && prev.iconImageUrl === next.iconImageUrl
    && prev.isFavorite === next.isFavorite
    && prev.isForeground === next.isForeground
    && prev.compactWindow === next.compactWindow
    && prev.renderWindowContent === next.renderWindowContent
    && prev.onCloseWindow === next.onCloseWindow
    && prev.onMinimizeWindow === next.onMinimizeWindow
    && prev.onToggleMaximize === next.onToggleMaximize
    && prev.onFocusWindow === next.onFocusWindow
    && prev.onToggleFavoriteApp === next.onToggleFavoriteApp;
}

export const Moa_HomeShellView: React.FC<Moa_HomeShellViewProps> = (props) => {
  const {
    t,
    language,
    systemState,
    systemDefaults,
    setSystemState,
    setSystemDefaults,
    editMode,
    toasts,
    effectiveSystemOptions,
    viewportWidth,
    overlayActive,
    isMobileOverlay,
    isRightOverlay,
    overlayFlushEdges,
    overlayPanelWidth,
    leftOffset,
    rightOffset,
    centerLeft,
    centerRight,
    leftOpen,
    rightOpen,
    activeTab,
    modeIdx,
    mainApps,
    mainAppsLoading,
    appsById,
    favoriteApps,
    favoriteIdsRef,
    createdApps,
    libraryHydration,
    sharedGeneratedApps,
    leftPanelMyApps,
    recentApps,
    taskbarItems,
    windows,
    isLoggedIn,
    currentUser,
    setActiveTab,
    setLeftOpen,
    setRightOpen,
    updateSystemState,
    handleModeChange,
    handleEnterEditMode,
    handleExitEditMode,
    handleDeleteApp,
    handleAddAppToMain,
    addAppToMain,
    reorderMainApps,
    mainAppsRef,
    toggleFavoriteApp,
    openApp,
    openMyPage,
    openAuthWindow,
    openBoardWindow,
    openUserProfileWindow,
    openShellSurface,
    openLegalPage,
    restoreTaskbarWindow,
    closeWindow,
    minimizeWindow,
    toggleMaximize,
    focusWindow,
    resolveWinTitle,
    openEditGeneratedApp,
    deleteSavedGeneratedApp,
    toggleGeneratedAppShare,
    openAppCommunityWindow,
    handleShellAuthenticated,
    handleShellProfileUpdated,
    handleMyPageTabChange,
    updateLegalPageWindowTitle,
    updateBoardWindowTitle,
    updateGeneratedAppWindowTitle,
    updateUserProfileWindowTitle,
    switchUserProfileWindowView,
    updateErrorWindowTitle,
  } = props;

  const [activeApp, setActiveApp] = useState<App | null>(null);
  const compactWindow = viewportWidth <= BREAKPOINT_FULLSCREEN_WINDOW;
  const compactControls = viewportWidth <= BREAKPOINT_COMPACT_CONTROLS;
  const authStateKey = buildShellAuthStateKey(currentUser?.memberKey);
  const createdAppsLoading = libraryHydration === 'loading' && isLoggedIn;

  const shellSystem = useMemo(
    () => ({
      systemState,
      systemDefaults,
      setSystemState,
      setSystemDefaults,
    }),
    [systemState, systemDefaults, setSystemState, setSystemDefaults],
  );

  const foregroundWindowId = useMemo(() => {
    const visible = windows.filter(item => !item.isMinimized);
    if (visible.length === 0) {
      return null;
    }
    return [...visible].sort((a, b) => b.zIndex - a.zIndex)[0]?.id ?? null;
  }, [windows]);

  const renderWindowContent = useCallback((win: WindowState) => (
    <Moa_ShellWindowRenderer
      win={win}
      t={t}
      compactWindow={compactWindow}
      authStateKey={authStateKey}
      currentUser={currentUser}
      isLoggedIn={isLoggedIn}
      createdApps={createdApps}
      createdAppsLoading={createdAppsLoading}
      favoriteApps={favoriteApps}
      recentApps={recentApps}
      shellSystem={shellSystem}
      resolveWinTitle={resolveWinTitle}
      onOpenApp={openApp}
      onEditGeneratedApp={openEditGeneratedApp}
      onDeleteGeneratedApp={deleteSavedGeneratedApp}
      onToggleGeneratedAppShare={toggleGeneratedAppShare}
      onOpenAppCommunity={openAppCommunityWindow}
      onOpenAuthWindow={openAuthWindow}
      onAuthenticated={handleShellAuthenticated}
      onProfileUpdated={handleShellProfileUpdated}
      onMyPageTabChange={handleMyPageTabChange}
      onOpenBoard={openBoardWindow}
      onLegalPageTitleResolved={updateLegalPageWindowTitle}
      onBoardWindowTitleResolved={updateBoardWindowTitle}
      onGeneratedAppWindowTitleResolved={updateGeneratedAppWindowTitle}
      onUserProfileWindowTitleResolved={updateUserProfileWindowTitle}
      onUserProfileViewChange={switchUserProfileWindowView}
      onErrorWindowTitleResolved={updateErrorWindowTitle}
    />
  ), [
    authStateKey,
    compactWindow,
    createdApps,
    createdAppsLoading,
    currentUser,
    isLoggedIn,
    deleteSavedGeneratedApp,
    favoriteApps,
    handleMyPageTabChange,
    handleShellAuthenticated,
    handleShellProfileUpdated,
    openApp,
    openAppCommunityWindow,
    openAuthWindow,
    openBoardWindow,
    openEditGeneratedApp,
    recentApps,
    resolveWinTitle,
    shellSystem,
    switchUserProfileWindowView,
    t,
    toggleGeneratedAppShare,
    updateBoardWindowTitle,
    updateGeneratedAppWindowTitle,
    updateErrorWindowTitle,
    updateLegalPageWindowTitle,
    updateUserProfileWindowTitle,
  ]);

  const handleCenterPanelExitEditMode = useCallback(() => {
    showAppEditToast('success', t('moa_shell.home.toast_main_grid_saved'));
    handleExitEditMode();
  }, [handleExitEditMode, t]);

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 4 } });
  const sensors = useSensors(pointerSensor);
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const pointerCollisions = pointerWithin(args);
    return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    const appId = id.startsWith('left-') ? id.replace('left-', '') : id;
    setActiveApp(appsById.get(appId) ?? null);
  }, [appsById]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveApp(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    if (activeId.startsWith('left-')) {
      const overId = String(over.id);
      if (overId === 'left-panel' || overId === 'right-panel') {
        return;
      }

      const droppedOnMainGrid = overId === 'main-grid' || mainAppsRef.current.some(item => item.id === overId);
      if (!droppedOnMainGrid) return;

      const appId = activeId.replace('left-', '');
      const app = appsById.get(appId);
      if (!app) return;

      const added = addAppToMain(app);
      showAppEditToast(
        added ? 'success' : 'warning',
        added ? t('moa_shell.home.toast_app_added') : t('moa_shell.home.toast_app_already'),
      );
      return;
    }

    const oldIdx = mainApps.findIndex(a => a.id === active.id);
    const newIdx = mainApps.findIndex(a => a.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    reorderMainApps(arrayMove(mainApps, oldIdx, newIdx));
  }, [addAppToMain, appsById, mainApps, mainAppsRef, reorderMainApps, t]);

  return (
    <Div className={`moa-home-root relative w-full max-w-[100vw] overflow-hidden text-primary ${editMode ? 'is-editing' : ''}`}
      style={{
        ...moaHomeShellCssVars(),
        backgroundImage: moabomBackgroundImageCssValue(systemState.appearance.backgroundImageId),
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>

      <Moa_LiquidGlassFilters />

      <Moa_WeatherEffectHost
        effective={effectiveSystemOptions}
        systemDefaults={systemDefaults}
      />

      <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <LeftPanel width={overlayPanelWidth} leftOffset={leftOffset} onOpenApp={openApp} activeTab={activeTab} onTabChange={setActiveTab}
          editMode={editMode} onEnterEditMode={handleEnterEditMode} favoriteApps={favoriteApps}
          createdApps={leftPanelMyApps}
          ownedGeneratedAppsLoading={libraryHydration === 'loading' && isLoggedIn}
          sharedApps={sharedGeneratedApps}
          isLoggedIn={isLoggedIn}
          onAddApp={handleAddAppToMain} onOpenBoard={openBoardWindow} onOpenUserProfile={openUserProfileWindow} isOverlay={isMobileOverlay} overlayFlushEdges={overlayFlushEdges} onClose={() => {
            setLeftOpen(false);
            updateSystemState({ layout: { leftPanelOpen: false } });
          }} />

        <CenterPanel centerLeft={centerLeft} centerRight={centerRight} leftOpen={leftOpen} rightOpen={rightOpen}
          onOpenMyPageSettings={() => { void openMyPage('settings'); }}
          onOpenLegalPage={openLegalPage}
          onToggleLeft={() => {
            setLeftOpen(v => {
              const next = !v;
              updateSystemState({ layout: { leftPanelOpen: next } });
              return next;
            });
          }} onToggleRight={() => {
            setRightOpen(v => {
              const next = !v;
              updateSystemState({ layout: { rightPanelOpen: next } });
              return next;
            });
          }}
          modeIdx={modeIdx} onModeChange={handleModeChange} filteredApps={mainApps}
          appsLoading={mainAppsLoading} onOpenApp={openApp}
          minimizedWindows={taskbarItems} onFocusWindow={restoreTaskbarWindow}
          editMode={editMode} onEnterEditMode={handleEnterEditMode} onExitEditMode={handleCenterPanelExitEditMode}
          onDeleteApp={handleDeleteApp} compactControls={compactControls}
          appsById={appsById} authWindowAppIds={AUTH_WINDOW_APP_IDS} />

        <DragOverlay dropAnimation={null} style={{ zIndex: 200 }}>
          {activeApp ? (
            <Div className="flex flex-col items-center gap-2 pointer-events-none" style={{ opacity: 0.85 }}>
              <Div
                className={`w-[72px] h-[72px] rounded-2xl flex items-center justify-center shadow-2xl ${
                  brandedAppIconClassName(activeApp.id)
                }`}
                style={
                  isBrandedShellAppId(activeApp.id)
                    ? getBrandedShellCssVars(activeApp.id)
                    : { background: activeApp.gradient }
                }
              >
                <Icon
                  name={activeApp.icon}
                  className={`text-white text-2xl drop-shadow ${
                    isBrandedShellAppId(activeApp.id) ? 'relative z-[1]' : ''
                  }`}
                />
              </Div>
              <Div
                className={`text-xs font-bold text-center truncate w-[80px] ${
                  isBrandedShellAppId(activeApp.id)
                    ? brandedTitleGradientClassName(activeApp.id) || 'create-app-title-gradient'
                    : 'text-secondary'
                }`}
              >
                {resolveAppStrings(activeApp, language).name}
              </Div>
            </Div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {overlayActive && (
        <Div
          className="moa-responsive-backdrop"
          onClick={() => {
            if (isMobileOverlay) {
              setLeftOpen(false);
              updateSystemState({ layout: { leftPanelOpen: false } });
            }
            setRightOpen(false);
            updateSystemState({ layout: { rightPanelOpen: false } });
          }}
        />
      )}

      <MoabomPresenceProvider isLoggedIn={isLoggedIn}>
        <RightPanel width={overlayPanelWidth} rightOffset={rightOffset} isLoggedIn={isLoggedIn} currentUser={currentUser} onOpenMyPage={openMyPage}
          notificationCenterEnabled={effectiveSystemOptions.notification_center !== false}
          onOpenAuth={openAuthWindow}
          onOpenShellSurface={openShellSurface}
          isOverlay={isRightOverlay} overlayFlushEdges={overlayFlushEdges} onClose={() => {
            setRightOpen(false);
            updateSystemState({ layout: { rightPanelOpen: false } });
          }} />

        {windows.map(win => {
          const chrome = resolveShellWindowChrome(win, appsById, language);
          return (
            <ShellWindowFrame
              key={win.id}
              win={win}
              title={chrome.title || resolveWinTitle(win)}
              icon={chrome.icon}
              gradient={chrome.gradient}
              iconImageUrl={chrome.iconImageUrl}
              isFavorite={favoriteIdsRef.current.includes(win.appId)}
              isForeground={foregroundWindowId == null || win.id === foregroundWindowId}
              compactWindow={compactWindow}
              renderWindowContent={renderWindowContent}
              onCloseWindow={closeWindow}
              onMinimizeWindow={minimizeWindow}
              onToggleMaximize={toggleMaximize}
              onFocusWindow={focusWindow}
              onToggleFavoriteApp={toggleFavoriteApp}
            />
          );
        })}
      </MoabomPresenceProvider>

      <Toast toasts={toasts} position="bottom-center" duration={4000} />
    </Div>
  );
};
