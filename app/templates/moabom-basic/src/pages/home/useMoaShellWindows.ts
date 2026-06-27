import { useCallback, useEffect, useRef, useState } from 'react';
import type { WindowState } from '../../components/composite/Moa_CenterPanel';
import type { MyPageTab } from '../../components/composite/Moa_MyPageWindowContent';
import type { AuthWindowMode } from '../../components/composite/Moa_AuthWindowContent';
import { APPS, type App } from '../../data/Moa_apps';
import {
  recordShellAppOpen,
  syncShellAppFocus,
} from '../../shell/moaShellAppUsageTracker';
import { createAppShellMetadata } from '../../apps/ai-generator/metadata';
import { setCreateAppEditServerId } from '../../apps/ai-generator/moabomCreateAppEditSession';
import { resolveAppStrings, resolveWindowTitle } from '../../i18n/resolveAppStrings';
import type { MoabomTranslateFn } from '../../i18n/moabomT';
import {
  MOA_SHELL_LEGAL_PAGE_PRIVACY_APP_ID,
  MOA_SHELL_LEGAL_PAGE_TERMS_APP_ID,
  type MoaShellLegalPageSlug,
} from '../../shell/moaShellLegalPageIds';
import {
  moaShellBoardAppId,
  moaShellBoardSlugFromAppId,
} from '../../shell/moaShellBoardIds';
import {
  SHELL_PROFILE_SURFACE_APP_ID,
  isMoaShellUserProfileAppId,
  moaShellUserProfileUuidFromAppId,
} from '../../shell/moaShellUserProfileIds';
import {
  findProfileSurfaceWindow,
  onProfileSurfaceSubjectChange,
  purgeProfileSurfaceWindows,
  reconcileProfileSurfaceWindows,
  resolveProfileSurfaceSubjectUuid,
} from '../../shell/shellProfileSurface';
import type { UserProfileWindowView } from '../../shell/userProfileWindowLayoutRuntime';
import {
  MOA_SHELL_ERROR_APP_ID,
  isMoaShellErrorAppId,
  type ShellErrorCode,
} from '../../shell/moaShellErrorIds';
import {
  formatShellPath,
  formatShellPathForWindow,
  formatBoardShellPath,
  formatUserProfileShellPath,
  parseShellRoute,
  pushShellPath,
  replaceShellPath,
  type BoardShellMode,
} from '../../utils/moabomShellRoutes';
import {
  buildSyntheticGeneratedLibraryApp,
  isGeneratedLibraryAppId,
} from '../../apps/generatedAppLibrary';
import { ensureMoabomFullTemplateRoutesMerged } from '../../runtime/moabomGhostRoutesFetch';
import { normalizeTaskbarItems, toTaskbarItem } from '../../shell/moaShellAppLists';
import {
  AUTH_WINDOW_APP_IDS,
  AUTH_WINDOW_HEIGHT,
  AUTH_WINDOW_WIDTH,
  BOARD_WINDOW_HEIGHT,
  BOARD_WINDOW_WIDTH,
  USER_PROFILE_WINDOW_HEIGHT,
  USER_PROFILE_WINDOW_WIDTH,
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  ERROR_WINDOW_HEIGHT,
  ERROR_WINDOW_WIDTH,
  LEGAL_PAGE_WINDOW_HEIGHT,
  LEGAL_PAGE_WINDOW_WIDTH,
  MAX_OPEN_WINDOWS,
  MAX_TASKBAR_ITEMS,
  MOA_SHELL_POINT_TITLE_GRADIENT,
  STORAGE_KEY_TASKBAR_ICONS,
  WINDOW_CASCADE_STEP,
} from '../../shell/moaShellLayoutConstants';
import { resolveShellWindowMaximized, saveShellWindowMaximized } from '../../shell/moaShellWindowMaximize';
import { loadJson, saveJson } from '../../shell/moaShellLocalStorage';
import { pushInfoToast, pushWarningToast } from '../../runtime/moaShellToasts';
import type { MoabomSystemLanguage } from '../../types/moabomSystem';
import type { AuthUserLike, MoaCurrentUser, ShellUrlSync } from '../../shell/moaShellTypes';
import { buildMoaCurrentUser, isGuestOnlyAuthMode } from '../../shell/moaShellTypes';
import { resolveErrorShellWindowTitle } from '../../shell/moaShellErrorTitles';
import { notifyBoardShellUrlChanged } from '../../shell/moaShellBoardBridge';
import { publishShellPresenceForeground } from '../../shell/moaShellPresenceBridge';
import { prefetchBoardWindowLayouts } from '../../shell/boardWindowPrefetch';
import {
  prefetchUserProfileWindowLayouts,
  resolveUserProfileShellSearch,
} from '../../shell/userProfileWindowPrefetch';
import type { ShellSurfaceOpenAction } from '../../shell/shellSurfaceTypes';
import { commitShellWindows } from '../../shell/shellWindowsCommit';

function resolveForegroundShellAppId(items: WindowState[]): string | null {
  const visible = items.filter(item => !item.isMinimized);
  if (visible.length === 0) {
    return null;
  }
  return [...visible].sort((a, b) => b.zIndex - a.zIndex)[0]?.appId ?? null;
}

function getNewWindowPosition(
  width: number,
  height: number,
  openCount: number,
): { initialX: number; initialY: number } {
  const targetWidth = Math.min(width, Math.max(400, window.innerWidth - 40));
  const targetHeight = Math.min(height, Math.max(300, window.innerHeight - 40));
  const centerX = Math.max(0, (window.innerWidth - targetWidth) / 2);
  const centerY = Math.max(0, (window.innerHeight - targetHeight) / 2);

  if (openCount === 0) {
    return { initialX: centerX, initialY: centerY };
  }

  const cascade = Math.min(openCount - 1, MAX_OPEN_WINDOWS - 2) * WINDOW_CASCADE_STEP;
  return {
    initialX: Math.max(0, centerX - WINDOW_CASCADE_STEP - cascade),
    initialY: Math.max(0, centerY - WINDOW_CASCADE_STEP - cascade),
  };
}

function getCenteredWindowPosition(
  width: number,
  height: number,
): { initialX: number; initialY: number } {
  const targetWidth = Math.min(width, Math.max(400, window.innerWidth - 40));
  const targetHeight = Math.min(height, Math.max(300, window.innerHeight - 40));
  return {
    initialX: Math.max(0, (window.innerWidth - targetWidth) / 2),
    initialY: Math.max(0, (window.innerHeight - targetHeight) / 2),
  };
}

function countOpenWindows(windows: WindowState[]): number {
  return windows.filter(w => !w.isMinimized).length;
}

function resolveForegroundShellWindow(items: WindowState[]): WindowState | null {
  const visible = items.filter(item => !item.isMinimized);
  const pool = visible.length > 0 ? visible : items;
  if (pool.length === 0) {
    return null;
  }
  return [...pool].sort((a, b) => b.zIndex - a.zIndex)[0] ?? null;
}

function doesShellLocationMatchWindow(pathname: string, search: string, win: WindowState): boolean {
  const current = `${pathname}${search}`;
  const canonical = formatShellPathForWindow(win);
  if (current === canonical) {
    return true;
  }

  if (win.appId === 'mypage' && pathname.startsWith('/me')) {
    return true;
  }

  const boardSlug = win.boardSlug ?? moaShellBoardSlugFromAppId(win.appId);
  if (boardSlug != null && pathname.startsWith(`/board/${encodeURIComponent(boardSlug)}`)) {
    return true;
  }

  const userProfileUuid = win.userProfileUuid ?? moaShellUserProfileUuidFromAppId(win.appId);
  if (userProfileUuid != null && pathname.startsWith(`/users/${encodeURIComponent(userProfileUuid)}`)) {
    return true;
  }

  if (isMoaShellErrorAppId(win.appId) && win.errorCode != null) {
    const errorPath = formatShellPath({ kind: 'error', code: win.errorCode });
    return pathname === errorPath;
  }

  return pathname === canonical.split(/[?#]/)[0];
}

export interface UseMoaShellWindowsOptions {
  t: MoabomTranslateFn;
  language: MoabomSystemLanguage;
  editMode: boolean;
  isLoggedIn: boolean;
  appsById: Map<string, App>;
  recordRecentApp: (app: App) => void;
  applyAuthState: (authenticated: boolean, user: AuthUserLike | null | undefined) => void;
  setCurrentUser: (user: MoaCurrentUser | null) => void;
}

export function useMoaShellWindows({
  t,
  language,
  editMode,
  isLoggedIn,
  appsById,
  recordRecentApp,
  applyAuthState,
  setCurrentUser,
}: UseMoaShellWindowsOptions) {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [nextZIndex, setNextZIndex] = useState(1000);
  const [taskbarItems, setTaskbarItems] = useState<WindowState[]>(() => (
    normalizeTaskbarItems(loadJson<Partial<WindowState>[]>(STORAGE_KEY_TASKBAR_ICONS, []))
  ));

  const windowsRef = useRef<WindowState[]>([]);
  const taskbarItemsRef = useRef<WindowState[]>(taskbarItems);

  const commitWindows = useCallback(
    (updater: (prev: WindowState[]) => WindowState[]) =>
      commitShellWindows(windowsRef, setWindows, updater),
    [],
  );

  useEffect(() => {
    windowsRef.current = windows;
  }, [windows]);

  useEffect(() => {
    syncShellAppFocus(resolveForegroundShellAppId(windows));
    const visible = windows.filter(item => !item.isMinimized);
    const foreground = visible.length > 0
      ? [...visible].sort((a, b) => b.zIndex - a.zIndex)[0]
      : null;
    publishShellPresenceForeground(foreground
      ? {
          appId: foreground.appId,
          title: foreground.title,
          boardSlug: foreground.boardSlug,
          boardPostId: foreground.boardPostId,
          boardMode: foreground.boardMode,
          userProfileUuid: foreground.userProfileUuid,
          myPageInitialTab: foreground.myPageInitialTab,
        }
      : null);
  }, [windows]);

  useEffect(() => {
    taskbarItemsRef.current = taskbarItems;
    const taskbarIcons = taskbarItems.map(w => ({
      id: w.id,
      appId: w.appId,
      title: w.title,
      icon: w.icon,
      gradient: w.gradient,
      initialX: w.initialX,
      initialY: w.initialY,
      myPageInitialTab: w.myPageInitialTab,
      editGeneratedAppId: w.editGeneratedAppId,
    }));
    saveJson(STORAGE_KEY_TASKBAR_ICONS, taskbarIcons);
  }, [taskbarItems]);

  useEffect(() => {
    if (!isLoggedIn) return;
    setWindows(prev =>
      prev.filter(w => !isGuestOnlyAuthMode(w.appId as AuthWindowMode)),
    );
    setTaskbarItems(prev =>
      prev.filter(w => !isGuestOnlyAuthMode(w.appId as AuthWindowMode)),
    );
  }, [isLoggedIn]);

  const removeWindowsByAppId = useCallback((appId: string) => {
    setWindows(prev => prev.filter(win => win.appId !== appId));
    setTaskbarItems(prev => prev.filter(win => win.appId !== appId));
  }, []);

  const resolveWinTitle = useCallback(
    (win: WindowState) => resolveWindowTitle(win, appsById, language, t, AUTH_WINDOW_APP_IDS),
    [appsById, language, t],
  );

  const restoreTaskbarWindow = useCallback((id: string) => {
    const item = taskbarItemsRef.current.find(w => w.id === id);
    if (!item) return;

    if (item.appId === createAppShellMetadata.id) {
      setCreateAppEditServerId(item.editGeneratedAppId);
    }

    const alreadyOpen = windowsRef.current.find(w => w.id === id || w.appId === item.appId);
    if (alreadyOpen) {
      setTaskbarItems(prev => prev.filter(w => w.id !== id));
      commitWindows(prev => prev.map(w => (w.id === alreadyOpen.id
        ? {
            ...w,
            zIndex: nextZIndex,
            isMinimized: false,
            ...(w.appId === 'mypage' ? { gradient: MOA_SHELL_POINT_TITLE_GRADIENT } : {}),
          }
        : w)));
      setNextZIndex(z => z + 1);
      pushShellPath(formatShellPathForWindow(alreadyOpen));
      return;
    }

    if (countOpenWindows(windowsRef.current) >= MAX_OPEN_WINDOWS) {
      pushWarningToast(t('moa_shell.home.toast_max_windows', { max: MAX_OPEN_WINDOWS }));
      return;
    }

    setTaskbarItems(prev => prev.filter(w => w.id !== id));
    const restored = {
      ...item,
      ...(item.appId === 'mypage' ? { gradient: MOA_SHELL_POINT_TITLE_GRADIENT } : {}),
      zIndex: nextZIndex,
      isMaximized: resolveShellWindowMaximized(),
      isMinimized: false,
    };
    commitWindows(prev => [...prev, restored]);
    setNextZIndex(z => z + 1);
    pushShellPath(formatShellPathForWindow(restored));
  }, [commitWindows, nextZIndex, t]);

  const openMyPage = useCallback((initialTab: MyPageTab = 'profile', sync: ShellUrlSync = {}) => {
    const myPageApp = APPS.find(app => app.id === 'mypage');
    if (!myPageApp) return;

    const existing = windowsRef.current.find(w => w.appId === myPageApp.id);
    const minimized = taskbarItemsRef.current.find(w => w.appId === myPageApp.id);
    if (!existing && minimized) {
      restoreTaskbarWindow(minimized.id);
      return;
    }

    const openWindowCount = countOpenWindows(windowsRef.current);
    if (!existing && openWindowCount >= MAX_OPEN_WINDOWS) {
      pushWarningToast(t('moa_shell.home.toast_max_windows', { max: MAX_OPEN_WINDOWS }));
      return;
    }

    if (!sync.skipUrl) {
      const nextPath = formatShellPath({ kind: 'me', tab: initialTab });
      if (existing) {
        commitWindows(prev => {
          const ex = prev.find(w => w.appId === myPageApp.id);
          if (!ex) return prev;
          return prev.map(w => w.id === ex.id
            ? {
                ...w,
                zIndex: nextZIndex,
                isMinimized: false,
                myPageInitialTab: initialTab,
                gradient: MOA_SHELL_POINT_TITLE_GRADIENT,
              }
            : w);
        });
        setNextZIndex(z => z + 1);
        replaceShellPath(nextPath);
        return;
      }
    }

    const position = getCenteredWindowPosition(DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT);
    const newWindow: WindowState = {
      id: `${myPageApp.id}-${Date.now()}`,
      appId: myPageApp.id,
      title: myPageApp.name,
      icon: myPageApp.icon,
      gradient: MOA_SHELL_POINT_TITLE_GRADIENT,
      zIndex: nextZIndex,
      ...position,
      isMaximized: resolveShellWindowMaximized(),
      isMinimized: false,
      myPageInitialTab: initialTab,
    };
    commitWindows(prev => {
      const ex = prev.find(w => w.appId === myPageApp.id);
      if (ex) {
        return prev.map(w => w.id === ex.id
          ? {
              ...w,
              zIndex: nextZIndex,
              isMinimized: false,
              myPageInitialTab: initialTab,
              gradient: MOA_SHELL_POINT_TITLE_GRADIENT,
            }
          : w);
      }
      return [...prev, newWindow];
    });
    setNextZIndex(z => z + 1);

    if (!sync.skipUrl) {
      pushShellPath(formatShellPath({ kind: 'me', tab: initialTab }));
    }
  }, [commitWindows, nextZIndex, restoreTaskbarWindow, t]);

  const openAuthWindow = useCallback((mode: AuthWindowMode, sync: ShellUrlSync = {}) => {
    if (isLoggedIn && isGuestOnlyAuthMode(mode)) {
      pushInfoToast(t('moa_shell.home.toast_already_logged_in'));
      return;
    }

    const configs: Record<AuthWindowMode, { title: string; icon: string; gradient: string }> = {
      login: { title: t('moa_shell.auth_windows.login'), icon: 'lock', gradient: MOA_SHELL_POINT_TITLE_GRADIENT },
      register: { title: t('moa_shell.auth_windows.register'), icon: 'user-plus', gradient: MOA_SHELL_POINT_TITLE_GRADIENT },
      'forgot-password': { title: t('moa_shell.auth_windows.forgot_password'), icon: 'envelope', gradient: MOA_SHELL_POINT_TITLE_GRADIENT },
      'reset-password': { title: t('moa_shell.auth_windows.reset_password'), icon: 'key', gradient: MOA_SHELL_POINT_TITLE_GRADIENT },
    };
    const config = configs[mode];

    const authWindowIds = new Set<string>(AUTH_WINDOW_APP_IDS);
    const normalizedWindows = windowsRef.current.filter(w => !authWindowIds.has(w.appId) || w.appId === mode);
    const existingAuth = normalizedWindows.find(w => w.appId === mode);
    const minimizedAuth = taskbarItemsRef.current.find(w => w.appId === mode);
    if (!existingAuth && minimizedAuth) {
      restoreTaskbarWindow(minimizedAuth.id);
      return;
    }

    const openWindowCount = countOpenWindows(normalizedWindows);
    if (!existingAuth && openWindowCount >= MAX_OPEN_WINDOWS) {
      pushWarningToast(t('moa_shell.home.toast_max_windows', { max: MAX_OPEN_WINDOWS }));
      return;
    }

    if (!sync.skipUrl) {
      const authPath = formatShellPath({ kind: 'auth', mode });
      setNextZIndex(currentZIndex => {
        commitWindows(prev => {
          const authWindowsNormalized = prev.filter(w => !authWindowIds.has(w.appId) || w.appId === mode);
          const existing = authWindowsNormalized.find(w => w.appId === mode);
          if (existing) {
            return authWindowsNormalized.map(w => w.id === existing.id
              ? { ...w, zIndex: currentZIndex, isMinimized: false, gradient: MOA_SHELL_POINT_TITLE_GRADIENT }
              : w);
          }

          const position = getCenteredWindowPosition(AUTH_WINDOW_WIDTH, AUTH_WINDOW_HEIGHT);
          return [...authWindowsNormalized, {
            id: `${mode}-${Date.now()}`,
            appId: mode,
            title: config.title,
            icon: config.icon,
            gradient: config.gradient,
            zIndex: currentZIndex,
            ...position,
            isMaximized: resolveShellWindowMaximized(),
            isMinimized: false,
          }];
        });
        if (!sync.skipUrl) {
          pushShellPath(authPath);
        }
        return currentZIndex + 1;
      });
      return;
    }

    setNextZIndex(currentZIndex => {
      commitWindows(prev => {
        const authWindowsNormalized = prev.filter(w => !authWindowIds.has(w.appId) || w.appId === mode);
        const existing = authWindowsNormalized.find(w => w.appId === mode);
        if (existing) {
          return authWindowsNormalized.map(w => w.id === existing.id
            ? { ...w, zIndex: currentZIndex, isMinimized: false, gradient: MOA_SHELL_POINT_TITLE_GRADIENT }
            : w);
        }

        const position = getCenteredWindowPosition(AUTH_WINDOW_WIDTH, AUTH_WINDOW_HEIGHT);
        return [...authWindowsNormalized, {
          id: `${mode}-${Date.now()}`,
          appId: mode,
          title: config.title,
          icon: config.icon,
          gradient: config.gradient,
          zIndex: currentZIndex,
          ...position,
          isMaximized: resolveShellWindowMaximized(),
          isMinimized: false,
        }];
      });

      return currentZIndex + 1;
    });
  }, [commitWindows, isLoggedIn, restoreTaskbarWindow, t]);

  const openCreateAppShell = useCallback((
    sync: ShellUrlSync = {},
    editGeneratedAppId?: number,
  ) => {
    if (editMode) return;

    const app = createAppShellMetadata;
    const existing = windowsRef.current.find(w => w.appId === app.id);
    const minimized = taskbarItemsRef.current.find(w => w.appId === app.id);
    if (!existing && minimized) {
      setCreateAppEditServerId(editGeneratedAppId);
      restoreTaskbarWindow(minimized.id);
      setWindows(prev => prev.map(w => (
        w.appId === app.id
          ? { ...w, editGeneratedAppId, isMinimized: false }
          : w
      )));
      if (!sync.skipUrl) {
        pushShellPath(formatShellPath({
          kind: 'app',
          appId: app.id,
          editGeneratedAppId,
        }));
      }
      return;
    }

    const openWindowCount = countOpenWindows(windowsRef.current);
    if (!existing && openWindowCount >= MAX_OPEN_WINDOWS) {
      pushWarningToast(t('moa_shell.home.toast_max_windows', { max: MAX_OPEN_WINDOWS }));
      return;
    }

    setCreateAppEditServerId(editGeneratedAppId);
    const { name: resolvedTitle } = resolveAppStrings(app, language);
    commitWindows(prev => {
      const ex = prev.find(w => w.appId === app.id);
      if (ex) {
        return prev.map(w => w.id === ex.id
          ? {
              ...w,
              zIndex: nextZIndex,
              isMinimized: false,
              editGeneratedAppId,
            }
          : w);
      }
      const position = getNewWindowPosition(DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT, countOpenWindows(prev));
      return [...prev, {
        id: `${app.id}-${Date.now()}`,
        appId: app.id,
        title: resolvedTitle,
        icon: app.icon,
        gradient: app.gradient,
        zIndex: nextZIndex,
        isMaximized: resolveShellWindowMaximized(),
        isMinimized: false,
        editGeneratedAppId,
        ...position,
      }];
    });
    setNextZIndex(z => z + 1);
    if (!sync.skipUrl) {
      pushShellPath(formatShellPath({
        kind: 'app',
        appId: app.id,
        editGeneratedAppId,
      }));
    }
  }, [commitWindows, editMode, language, nextZIndex, restoreTaskbarWindow, t]);

  const openEditGeneratedApp = useCallback((serverId: number) => {
    openCreateAppShell({}, serverId);
  }, [openCreateAppShell]);

  const openApp = useCallback((app: App, sync: ShellUrlSync = {}) => {
    if (editMode) return;
    if (app.id === 'mypage') {
      void openMyPage('profile', sync);
      return;
    }
    if (app.id === createAppShellMetadata.id) {
      openCreateAppShell(sync);
      return;
    }

    const existing = windowsRef.current.find(w => w.appId === app.id);
    const minimized = taskbarItemsRef.current.find(w => w.appId === app.id);
    if (!existing && minimized) {
      recordRecentApp(app);
      recordShellAppOpen(app.id);
      restoreTaskbarWindow(minimized.id);
      return;
    }

    const openWindowCount = countOpenWindows(windowsRef.current);
    if (!existing && openWindowCount >= MAX_OPEN_WINDOWS) {
      pushWarningToast(t('moa_shell.home.toast_max_windows', { max: MAX_OPEN_WINDOWS }));
      return;
    }

    recordRecentApp(app);
    if (!existing) {
      recordShellAppOpen(app.id);
    }
    const { name: resolvedTitle } = resolveAppStrings(app, language);
    commitWindows(prev => {
      const ex = prev.find(w => w.appId === app.id);
      if (ex) {
        return prev.map(w => w.id === ex.id ? { ...w, zIndex: nextZIndex, isMinimized: false } : w);
      }
      const position = getNewWindowPosition(DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT, countOpenWindows(prev));
      return [...prev, {
        id: `${app.id}-${Date.now()}`, appId: app.id, title: resolvedTitle, icon: app.icon,
        gradient: app.gradient, zIndex: nextZIndex,
        isMaximized: resolveShellWindowMaximized(), isMinimized: false,
        ...position,
      }];
    });
    setNextZIndex(z => z + 1);
    if (!sync.skipUrl) {
      pushShellPath(formatShellPath({ kind: 'app', appId: app.id }));
    }
  }, [commitWindows, editMode, language, nextZIndex, openCreateAppShell, openMyPage, recordRecentApp, restoreTaskbarWindow, t]);

  const updateLegalPageWindowTitle = useCallback((windowId: string, title: string) => {
    setWindows(prev => prev.map(w => (w.id === windowId ? { ...w, title } : w)));
  }, []);

  const updateBoardWindowTitle = useCallback((windowId: string, title: string) => {
    setWindows(prev => prev.map(w => (w.id === windowId ? { ...w, title } : w)));
  }, []);

  const updateErrorWindowTitle = useCallback((windowId: string, title: string) => {
    setWindows(prev => prev.map(w => (w.id === windowId ? { ...w, title } : w)));
  }, []);

  const openErrorWindow = useCallback(
    (code: ShellErrorCode, sync: ShellUrlSync = {}): boolean => {
      if (editMode) return false;

      const appId = MOA_SHELL_ERROR_APP_ID;
      const shellPath = sync.shellPath ?? formatShellPath({ kind: 'error', code });
      const resolvedTitle = resolveErrorShellWindowTitle(code, t);

      const syncErrorShellUrl = () => {
        if (sync.skipUrl && !sync.shellPath) return;
        const next = shellPath;
        if (sync.replace) {
          replaceShellPath(next);
        } else {
          pushShellPath(next);
        }
      };

      const existing = windowsRef.current.find(w => w.appId === appId);
      const minimized = taskbarItemsRef.current.find(w => w.appId === appId);

      if (!existing && minimized) {
        restoreTaskbarWindow(minimized.id);
        commitWindows(prev => prev.map(w => (w.appId === appId
          ? { ...w, errorCode: code, title: resolvedTitle }
          : w)));
        syncErrorShellUrl();
        return true;
      }

      if (existing) {
        commitWindows(prev => prev.map(w => (w.id === existing.id
          ? {
            ...w,
            errorCode: code,
            title: resolvedTitle,
            zIndex: nextZIndex,
            isMinimized: false,
          }
          : w)));
        setNextZIndex(z => z + 1);
        syncErrorShellUrl();
        return true;
      }

      const openWindowCount = countOpenWindows(windowsRef.current);
      if (openWindowCount >= MAX_OPEN_WINDOWS) {
        pushWarningToast(t('moa_shell.home.toast_max_windows', { max: MAX_OPEN_WINDOWS }));
        return false;
      }

      const position = getNewWindowPosition(
        ERROR_WINDOW_WIDTH,
        ERROR_WINDOW_HEIGHT,
        countOpenWindows(windowsRef.current),
      );

      commitWindows(prev => [...prev, {
        id: `${appId}-${Date.now()}`,
        appId,
        errorCode: code,
        title: resolvedTitle,
        icon: 'exclamation-triangle',
        gradient: MOA_SHELL_POINT_TITLE_GRADIENT,
        zIndex: nextZIndex,
        isMaximized: resolveShellWindowMaximized(),
        isMinimized: false,
        ...position,
      }]);
      setNextZIndex(z => z + 1);
      syncErrorShellUrl();
      return true;
    },
    [commitWindows, editMode, nextZIndex, restoreTaskbarWindow, t],
  );

  const closeErrorWindow = useCallback(() => {
    setWindows(prev => prev.filter(w => !isMoaShellErrorAppId(w.appId)));
    setTaskbarItems(prev => prev.filter(w => !isMoaShellErrorAppId(w.appId)));
    if (typeof window !== 'undefined') {
      const route = parseShellRoute(window.location.pathname, window.location.search);
      if (route.kind === 'error') {
        replaceShellPath('/');
      }
    }
  }, []);

  const openBoardWindow = useCallback(
    (slug: string, postId?: string, sync: ShellUrlSync = {}, boardMode?: BoardShellMode) => {
      if (editMode) return;

      const normalizedSlug = slug.trim();
      if (!normalizedSlug) return;

      prefetchBoardWindowLayouts(normalizedSlug, postId, boardMode);

      const appId = moaShellBoardAppId(normalizedSlug);
      const shellPath = sync.shellPath
        ?? formatBoardShellPath(
          normalizedSlug,
          postId,
          typeof window !== 'undefined' ? window.location.search : '',
          boardMode,
        );

      const syncBoardShellUrl = () => {
        if (sync.skipUrl && !sync.shellPath) return;
        const next = shellPath;
        if (sync.replace) {
          replaceShellPath(next);
        } else {
          pushShellPath(next);
        }
        notifyBoardShellUrlChanged();
      };

      const existing = windowsRef.current.find(w => w.appId === appId);
      const minimized = taskbarItemsRef.current.find(w => w.appId === appId);

      if (!existing && minimized) {
        restoreTaskbarWindow(minimized.id);
        commitWindows(prev => prev.map(w => (w.appId === appId
          ? { ...w, boardSlug: normalizedSlug, boardPostId: postId, boardMode }
          : w)));
        syncBoardShellUrl();
        return;
      }

      if (existing) {
        commitWindows(prev => prev.map(w => (w.id === existing.id
          ? {
            ...w,
            boardSlug: normalizedSlug,
            boardPostId: postId,
            boardMode,
            zIndex: nextZIndex,
            isMinimized: false,
          }
          : w)));
        setNextZIndex(z => z + 1);
        syncBoardShellUrl();
        return;
      }

      const openWindowCount = countOpenWindows(windowsRef.current);
      if (openWindowCount >= MAX_OPEN_WINDOWS) {
        pushWarningToast(t('moa_shell.home.toast_max_windows', { max: MAX_OPEN_WINDOWS }));
        return;
      }

      const position = getNewWindowPosition(
        BOARD_WINDOW_WIDTH,
        BOARD_WINDOW_HEIGHT,
        countOpenWindows(windowsRef.current),
      );

      commitWindows(prev => [...prev, {
        id: `${appId}-${Date.now()}`,
        appId,
        boardSlug: normalizedSlug,
        boardPostId: postId,
        boardMode,
        title: t('moa_shell.center.board_window', { slug: normalizedSlug }),
        icon: 'comments',
        gradient: MOA_SHELL_POINT_TITLE_GRADIENT,
        zIndex: nextZIndex,
        isMaximized: resolveShellWindowMaximized(),
        isMinimized: false,
        ...position,
      }]);
      setNextZIndex(z => z + 1);
      syncBoardShellUrl();
    },
    [commitWindows, editMode, nextZIndex, restoreTaskbarWindow, t],
  );

  const openUserProfileWindow = useCallback(
    (
      userUuid: string,
      displayName?: string,
      sync: ShellUrlSync = {},
      view: UserProfileWindowView = 'profile',
    ) => {
      if (editMode) return;

      const normalizedUuid = userUuid.trim();
      if (!normalizedUuid) return;

      prefetchUserProfileWindowLayouts(view);

      const appId = SHELL_PROFILE_SURFACE_APP_ID;
      const shellPath = sync.shellPath
        ?? formatUserProfileShellPath(
          normalizedUuid,
          view,
          typeof window !== 'undefined' ? window.location.search : '',
        );

      const syncUserProfileShellUrl = () => {
        if (sync.skipUrl && !sync.shellPath) return;
        const next = shellPath;
        if (sync.replace) {
          replaceShellPath(next);
        } else {
          pushShellPath(next);
        }
        notifyBoardShellUrlChanged();
      };

      const priorSurface = findProfileSurfaceWindow(windowsRef.current);
      onProfileSurfaceSubjectChange(
        resolveProfileSurfaceSubjectUuid(priorSurface),
        normalizedUuid,
      );

      const existingAny = priorSurface
        ?? windowsRef.current.find(w => w.appId === appId);
      const minimized = taskbarItemsRef.current.find(w => isMoaShellUserProfileAppId(w.appId));

      const surfaceParams = { userUuid: normalizedUuid, view, displayName };

      if (!existingAny && minimized) {
        restoreTaskbarWindow(minimized.id);
        commitWindows(prev => reconcileProfileSurfaceWindows(prev, surfaceParams).windows);
        setTaskbarItems(prev => purgeProfileSurfaceWindows(prev).map(w => (w.id === minimized.id
          ? {
            ...w,
            appId,
            userProfileUuid: normalizedUuid,
            userProfileView: view,
            title: displayName?.trim() || w.title,
          }
          : w)));
        syncUserProfileShellUrl();
        return;
      }

      if (existingAny) {
        commitWindows(prev => reconcileProfileSurfaceWindows(prev, surfaceParams, {
          zIndex: nextZIndex,
          isMinimized: false,
        }).windows);
        setTaskbarItems(prev => purgeProfileSurfaceWindows(prev));
        setNextZIndex(z => z + 1);
        syncUserProfileShellUrl();
        return;
      }

      const openWindowCount = countOpenWindows(purgeProfileSurfaceWindows(windowsRef.current));
      if (openWindowCount >= MAX_OPEN_WINDOWS) {
        pushWarningToast(t('moa_shell.home.toast_max_windows', { max: MAX_OPEN_WINDOWS }));
        return;
      }

      const position = getNewWindowPosition(
        USER_PROFILE_WINDOW_WIDTH,
        USER_PROFILE_WINDOW_HEIGHT,
        openWindowCount,
      );

      commitWindows(prev => {
        const { windows: cleaned } = reconcileProfileSurfaceWindows(prev, surfaceParams);
        return [...cleaned, {
        id: `${appId}-${Date.now()}`,
        appId,
        userProfileUuid: normalizedUuid,
        userProfileView: view,
        title: displayName?.trim() || t('moa_shell.center.user_profile_window'),
        icon: 'user',
        gradient: MOA_SHELL_POINT_TITLE_GRADIENT,
        zIndex: nextZIndex,
        isMaximized: resolveShellWindowMaximized(),
        isMinimized: false,
        ...position,
        }];
      });
      setTaskbarItems(prev => purgeProfileSurfaceWindows(prev));
      setNextZIndex(z => z + 1);
      syncUserProfileShellUrl();
    },
    [commitWindows, editMode, nextZIndex, restoreTaskbarWindow, t],
  );

  const updateUserProfileWindowTitle = useCallback((windowId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setWindows(prev => prev.map(w => (w.id === windowId ? { ...w, title: trimmed } : w)));
    setTaskbarItems(prev => prev.map(w => (w.id === windowId ? { ...w, title: trimmed } : w)));
  }, []);

  const switchUserProfileWindowView = useCallback((
    windowId: string,
    view: UserProfileWindowView,
  ) => {
    const win = windowsRef.current.find(w => w.id === windowId);
    if (!win) return;

    const uuid = win.userProfileUuid ?? moaShellUserProfileUuidFromAppId(win.appId);
    if (!uuid) return;

    prefetchUserProfileWindowLayouts(view);

    const search = resolveUserProfileShellSearch(
      view,
      typeof window !== 'undefined' ? window.location.search : '',
    );
    const shellPath = formatUserProfileShellPath(uuid, view, search);
    replaceShellPath(shellPath);
    notifyBoardShellUrlChanged();

    setWindows(prev => prev.map(w => (w.id === windowId
      ? { ...w, userProfileView: view, zIndex: nextZIndex, isMinimized: false }
      : w)));
    setNextZIndex(z => z + 1);
  }, [nextZIndex]);

  const openLegalPage = useCallback(
    (slug: MoaShellLegalPageSlug) => {
      if (editMode) return;

      const spec = slug === 'terms'
        ? {
          appId: MOA_SHELL_LEGAL_PAGE_TERMS_APP_ID,
          icon: 'file-alt',
          gradient: MOA_SHELL_POINT_TITLE_GRADIENT,
          titleKey: 'moa_shell.center.terms' as const,
        }
        : {
          appId: MOA_SHELL_LEGAL_PAGE_PRIVACY_APP_ID,
          icon: 'user-shield',
          gradient: MOA_SHELL_POINT_TITLE_GRADIENT,
          titleKey: 'moa_shell.center.privacy' as const,
        };

      const existing = windowsRef.current.find(w => w.appId === spec.appId);
      const minimized = taskbarItemsRef.current.find(w => w.appId === spec.appId);
      if (!existing && minimized) {
        restoreTaskbarWindow(minimized.id);
        return;
      }
      if (existing) {
        setWindows(prev => prev.map(w => (w.id === existing.id
          ? { ...w, zIndex: nextZIndex, isMinimized: false, gradient: MOA_SHELL_POINT_TITLE_GRADIENT }
          : w)));
        setNextZIndex(z => z + 1);
        return;
      }

      const openWindowCount = countOpenWindows(windowsRef.current);
      if (openWindowCount >= MAX_OPEN_WINDOWS) {
        pushWarningToast(t('moa_shell.home.toast_max_windows', { max: MAX_OPEN_WINDOWS }));
        return;
      }

      const position = getNewWindowPosition(
        LEGAL_PAGE_WINDOW_WIDTH,
        LEGAL_PAGE_WINDOW_HEIGHT,
        countOpenWindows(windowsRef.current),
      );

      setWindows(prev => [...prev, {
        id: `${spec.appId}-${Date.now()}`,
        appId: spec.appId,
        title: t(spec.titleKey),
        icon: spec.icon,
        gradient: spec.gradient,
        zIndex: nextZIndex,
        isMaximized: resolveShellWindowMaximized(),
        isMinimized: false,
        ...position,
      }]);
      setNextZIndex(z => z + 1);
    },
    [editMode, nextZIndex, restoreTaskbarWindow, t],
  );

  const applyShellRoute = useCallback(
    (route: ReturnType<typeof parseShellRoute>) => {
      switch (route.kind) {
        case 'home': {
          const foreground = resolveForegroundShellWindow(windowsRef.current);
          if (foreground) {
            const target = formatShellPathForWindow(foreground);
            const current = `${window.location.pathname}${window.location.search}`;
            if (current !== target) {
              replaceShellPath(target);
            }
            break;
          }
          commitWindows(() => []);
          setCreateAppEditServerId(null);
          break;
        }
        case 'auth': {
          if (isLoggedIn && isGuestOnlyAuthMode(route.mode)) {
            replaceShellPath('/');
            return;
          }
          openAuthWindow(route.mode, { skipUrl: true });
          break;
        }
        case 'me':
          void openMyPage(route.tab, { skipUrl: true });
          break;
        case 'app': {
          if (route.appId === createAppShellMetadata.id) {
            openCreateAppShell({ skipUrl: true }, route.editGeneratedAppId);
            break;
          }
          // 딥링크: 창 메타만 합성. 표시·실행 검증은 GeneratedAppViewer(API)가 담당.
          const generated = isGeneratedLibraryAppId(route.appId)
            ? buildSyntheticGeneratedLibraryApp(route.appId)
            : null;
          if (generated) {
            openApp(generated, { skipUrl: true });
            break;
          }
          const app = APPS.find(a => a.id === route.appId);
          if (app) {
            openApp(app, { skipUrl: true });
          }
          break;
        }
        case 'board':
          openBoardWindow(route.slug, route.postId, { skipUrl: true }, route.boardMode);
          break;
        case 'userProfile':
          openUserProfileWindow(route.uuid, undefined, { skipUrl: true }, route.view);
          break;
        case 'error':
          openErrorWindow(route.code as ShellErrorCode, { skipUrl: true });
          break;
        case 'router': {
          commitWindows(() => []);
          setCreateAppEditServerId(null);
          const routerPath = route.search ? `${route.path}${route.search}` : route.path;
          void ensureMoabomFullTemplateRoutesMerged().finally(() => {
            window.__templateApp?.getRouter?.()?.navigate(routerPath);
          });
          break;
        }
      }
    },
    [commitWindows, isLoggedIn, openApp, openAuthWindow, openBoardWindow, openCreateAppShell, openErrorWindow, openMyPage, openUserProfileWindow],
  );

  const closeAuthWindows = useCallback(() => {
    setWindows(prev => prev.filter(item => !(AUTH_WINDOW_APP_IDS as readonly string[]).includes(item.appId)));
    setTaskbarItems(prev => prev.filter(item => !(AUTH_WINDOW_APP_IDS as readonly string[]).includes(item.appId)));
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/auth')) {
      replaceShellPath('/');
    }
  }, []);

  const closeWindow = useCallback((win: WindowState) => {
    const remaining = commitWindows(prev => prev.filter(w => w.id !== win.id));

    if (typeof window === 'undefined') {
      return;
    }

    const { pathname, search } = window.location;
    if (!doesShellLocationMatchWindow(pathname, search, win)) {
      return;
    }

    const foreground = resolveForegroundShellWindow(remaining);
    if (foreground) {
      replaceShellPath(formatShellPathForWindow(foreground));
      return;
    }

    replaceShellPath('/');
  }, [commitWindows]);

  const minimizeWindow = useCallback((id: string) => {
    const target = windowsRef.current.find(w => w.id === id);
    if (!target) return;

    if (taskbarItemsRef.current.length >= MAX_TASKBAR_ITEMS) {
      pushWarningToast(t('moa_shell.home.toast_max_taskbar', { max: MAX_TASKBAR_ITEMS }));
      return;
    }

    setWindows(prev => prev.filter(w => w.id !== id));
    setTaskbarItems(prev => {
      if (prev.some(w => w.id === id)) return prev;
      return [...prev, toTaskbarItem(target)];
    });
  }, [t]);

  const toggleMaximize = useCallback((id: string) => {
    setWindows(p => p.map(w => {
      if (w.id !== id) return w;
      const isMaximized = !w.isMaximized;
      saveShellWindowMaximized(isMaximized);
      return { ...w, isMaximized };
    }));
  }, []);

  const focusWindow = useCallback((id: string) => {
    setWindows(p => p.map(w => w.id === id ? { ...w, zIndex: nextZIndex, isMinimized: false } : w));
    setNextZIndex(z => z + 1);
  }, [nextZIndex]);

  const handleMyPageTabChange = useCallback((winId: string, tab: MyPageTab) => {
    replaceShellPath(formatShellPath({ kind: 'me', tab }));
    setWindows(prev => {
      let changed = false;
      const next = prev.map(w => {
        if (w.id !== winId || w.appId !== 'mypage') {
          return w;
        }
        if (w.myPageInitialTab === tab) {
          return w;
        }
        changed = true;
        return { ...w, myPageInitialTab: tab };
      });
      return changed ? next : prev;
    });
  }, []);

  const handleShellAuthenticated = useCallback((user?: AuthUserLike | null) => {
    applyAuthState(true, user ?? null);
    closeAuthWindows();
  }, [applyAuthState, closeAuthWindows]);

  const handleShellProfileUpdated = useCallback((user?: AuthUserLike | null) => {
    setCurrentUser(buildMoaCurrentUser(user ?? null, t('moa_shell.common.user_fallback')));
  }, [setCurrentUser, t]);

  const openShellSurface = useCallback((
    action: ShellSurfaceOpenAction,
    sync: ShellUrlSync = {},
  ) => {
    switch (action.kind) {
      case 'profile':
        openUserProfileWindow(
          action.userUuid,
          action.displayName,
          sync,
          action.view ?? 'profile',
        );
        break;
      case 'board':
        openBoardWindow(action.slug, action.postId, sync, action.boardMode);
        break;
      case 'mypage':
        void openMyPage(action.tab, sync);
        break;
    }
  }, [openBoardWindow, openMyPage, openUserProfileWindow]);

  return {
    windows,
    windowsRef,
    taskbarItems,
    taskbarItemsRef,
    setWindows,
    setTaskbarItems,
    resolveWinTitle,
    restoreTaskbarWindow,
    openMyPage,
    openAuthWindow,
    openCreateAppShell,
    openEditGeneratedApp,
    openApp,
    openErrorWindow,
    closeErrorWindow,
    openBoardWindow,
    openUserProfileWindow,
    openShellSurface,
    openLegalPage,
    applyShellRoute,
    closeAuthWindows,
    closeWindow,
    minimizeWindow,
    toggleMaximize,
    focusWindow,
    handleMyPageTabChange,
    handleShellAuthenticated,
    handleShellProfileUpdated,
    updateLegalPageWindowTitle,
    updateBoardWindowTitle,
    updateUserProfileWindowTitle,
    switchUserProfileWindowView,
    updateErrorWindowTitle,
    removeWindowsByAppId,
  };
}
