import React, { useCallback, useEffect, useRef } from 'react';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import { installShellAppUsageTracker } from '../../shell/moaShellAppUsageTracker';
import { whenMoabomBootPhaseAtLeast } from '../../runtime/moabomShellBootPipeline';
import { Moa_HomeShellView } from './Moa_HomeShellView';
import type { HomePageProps } from '../../shell/moaShellTypes';
import { useMoabomShellAuth } from './useMoabomShellAuth';
import { useMoaHomeShellState } from './useMoaHomeShellState';
import { useMoaHomeAppCatalog } from './useMoaHomeAppCatalog';
import { useMoaShellWindows } from './useMoaShellWindows';
import { useMoaShellRouteSync } from './useMoaShellRouteSync';
import { useMoaShellSocialAuth } from './useMoaShellSocialAuth';
import type { UserProfileWindowView } from '../../shell/userProfileWindowLayoutRuntime';

export const HomePageInner: React.FC<HomePageProps> = ({ initialWindow }) => {
  const { t, language } = useMoabomShellT();
  const isLoggedInRef = useRef(false);
  const removeWindowsByAppIdRef = useRef<(appId: string) => void>(() => {});

  const shell = useMoaHomeShellState();

  const {
    isLoggedIn,
    currentUser,
    setCurrentUser,
    applyAuthState,
  } = useMoabomShellAuth({
    nameFallback: t('moa_shell.common.user_fallback'),
  });

  useEffect(() => {
    isLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn]);

  const catalog = useMoaHomeAppCatalog({
    isLoggedIn,
    currentUser,
    isLoggedInRef,
    t,
    setSystemState: shell.setSystemState,
    setSystemDefaults: shell.setSystemDefaults,
    onGeneratedAppRemoved: (appId) => removeWindowsByAppIdRef.current(appId),
  });

  const windows = useMoaShellWindows({
    t,
    language,
    editMode: shell.editMode,
    isLoggedIn,
    appsById: catalog.appsById,
    recordRecentApp: catalog.recordRecentApp,
    applyAuthState,
    setCurrentUser,
  });

  removeWindowsByAppIdRef.current = windows.removeWindowsByAppId;

  useMoaShellRouteSync({
    windowsRef: windows.windowsRef,
    applyShellRoute: windows.applyShellRoute,
    openErrorWindow: windows.openErrorWindow,
    closeErrorWindow: windows.closeErrorWindow,
    openBoardWindow: windows.openBoardWindow,
    openAuthWindow: windows.openAuthWindow,
    openAppById: windows.openAppById,
    openMyPage: windows.openMyPage,
    openUserProfileWindow: windows.openUserProfileWindow,
    initialWindow,
    isLoggedIn,
  });

  useMoaShellSocialAuth({
    t,
    isLoggedInRef,
    applyAuthState,
    closeAuthWindows: windows.closeAuthWindows,
    openAuthWindow: windows.openAuthWindow,
  });

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    const cancelBoot = whenMoabomBootPhaseAtLeast('tertiary-idle', () => {
      cleanup = installShellAppUsageTracker();
    });
    return () => {
      cancelBoot();
      cleanup?.();
    };
  }, []);

  const openShellProfileFromPanel = useCallback(
    (userUuid: string, displayName?: string, view?: UserProfileWindowView) => {
      windows.openShellSurface({
        kind: 'profile',
        userUuid,
        displayName,
        view: view ?? 'profile',
      });
    },
    [windows.openShellSurface],
  );

  return (
    <Moa_HomeShellView
      t={t}
      language={language}
      systemState={shell.systemState}
      systemDefaults={shell.systemDefaults}
      setSystemState={shell.setSystemState}
      setSystemDefaults={shell.setSystemDefaults}
      editMode={shell.editMode}
      toasts={shell.toasts}
      effectiveSystemOptions={shell.effectiveSystemOptions}
      viewportWidth={shell.viewportWidth}
      overlayActive={shell.overlayActive}
      isMobileOverlay={shell.isMobileOverlay}
      isRightOverlay={shell.isRightOverlay}
      overlayFlushEdges={shell.overlayFlushEdges}
      overlayPanelWidth={shell.overlayPanelWidth}
      leftOffset={shell.leftOffset}
      rightOffset={shell.rightOffset}
      centerLeft={shell.centerLeft}
      centerRight={shell.centerRight}
      leftOpen={shell.leftOpen}
      rightOpen={shell.rightOpen}
      activeTab={shell.activeTab}
      modeIdx={shell.modeIdx}
      mainApps={catalog.mainApps}
      appsById={catalog.appsById}
      favoriteApps={catalog.favoriteApps}
      favoriteIdsRef={catalog.favoriteIdsRef}
      createdApps={catalog.createdApps}
      libraryHydration={catalog.libraryHydration}
      sharedGeneratedApps={catalog.sharedGeneratedApps}
      leftPanelMyApps={catalog.leftPanelMyApps}
      recentApps={catalog.recentApps}
      taskbarItems={windows.taskbarItems}
      windows={windows.windows}
      isLoggedIn={isLoggedIn}
      currentUser={currentUser}
      setActiveTab={shell.setActiveTab}
      setLeftOpen={shell.setLeftOpen}
      setRightOpen={shell.setRightOpen}
      updateSystemState={shell.updateSystemState}
      handleModeChange={shell.handleModeChange}
      handleEnterEditMode={shell.handleEnterEditMode}
      handleExitEditMode={shell.handleExitEditMode}
      handleDeleteApp={catalog.handleDeleteApp}
      handleAddAppToMain={catalog.handleAddAppToMain}
      addAppToMain={catalog.addAppToMain}
      reorderMainApps={catalog.reorderMainApps}
      mainAppsRef={catalog.mainAppsRef}
      toggleFavoriteApp={catalog.toggleFavoriteApp}
      openApp={windows.openApp}
      openMyPage={windows.openMyPage}
      openAuthWindow={windows.openAuthWindow}
      openBoardWindow={windows.openBoardWindow}
      openUserProfileWindow={openShellProfileFromPanel}
      openShellSurface={windows.openShellSurface}
      openLegalPage={windows.openLegalPage}
      restoreTaskbarWindow={windows.restoreTaskbarWindow}
      closeWindow={windows.closeWindow}
      minimizeWindow={windows.minimizeWindow}
      toggleMaximize={windows.toggleMaximize}
      focusWindow={windows.focusWindow}
      resolveWinTitle={windows.resolveWinTitle}
      openEditGeneratedApp={windows.openEditGeneratedApp}
      deleteSavedGeneratedApp={catalog.deleteSavedGeneratedApp}
      toggleGeneratedAppShare={catalog.toggleGeneratedAppShare}
      openAppCommunityWindow={windows.openAppCommunityWindow}
      handleShellAuthenticated={windows.handleShellAuthenticated}
      handleShellProfileUpdated={windows.handleShellProfileUpdated}
      handleMyPageTabChange={windows.handleMyPageTabChange}
      updateLegalPageWindowTitle={windows.updateLegalPageWindowTitle}
      updateBoardWindowTitle={windows.updateBoardWindowTitle}
      updateGeneratedAppWindowTitle={windows.updateGeneratedAppWindowTitle}
      updateUserProfileWindowTitle={windows.updateUserProfileWindowTitle}
      switchUserProfileWindowView={windows.switchUserProfileWindowView}
      updateErrorWindowTitle={windows.updateErrorWindowTitle}
    />
  );
};
