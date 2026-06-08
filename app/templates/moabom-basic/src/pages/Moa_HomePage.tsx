import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { Window } from '../components/composite/Moa_Window';
import { LeftPanel } from '../components/composite/Moa_LeftPanel';
import { CenterPanel, type WindowState } from '../components/composite/Moa_CenterPanel';
import { RightPanel } from '../components/composite/Moa_RightPanel';
import type { MyPageTab } from '../components/composite/Moa_MyPageWindowContent';
import type { AuthWindowMode } from '../components/composite/Moa_AuthWindowContent';
import { MoabomUiI18nProvider, useMoabomShellT } from '../i18n/MoabomUiI18nProvider';
import { resolveAppStrings, resolveWindowTitle } from '../i18n/resolveAppStrings';
import Toast, { type ToastItem } from '../components/composite/Toast';
import { Div } from '../components/basic/Div';
import { Canvas } from '../components/basic/Canvas';
import { Icon } from '../components/basic/Icon';
import { APPS, type App } from '../data/Moa_apps';
import { MY_APPS_DATA } from '../data/Moa_mockData';
import { subscribeSocialAuthPopupMessages, type SocialAuthPopupMessage } from '../utils/socialAuth';
import type { MoabomSystemDefaults, MoabomSystemState, MoabomSystemStateMergePatch } from '../types/moabomSystem';
import {
  CENTER_MODE_TO_INDEX,
  INDEX_TO_CENTER_MODE,
  MOABOM_SYSTEM_STATE_CHANGED_EVENT,
  applyMoabomSystemAppearance,
  loadMoabomSystemState,
  mergeMoabomSystemState,
  saveMoabomSystemState,
} from '../utils/moabomSystemStore';
import { areMoabomSystemStatesEqual } from '../utils/moabomSystemStateEqual';
import { pullMoabomServerState } from '../utils/moabomPullServerState';
import { applyMoabomAnimationRuntime } from '../runtime/applyAnimationRuntime';
import { useEffectiveSystemOptions } from '../runtime/useEffectiveSystemOptions';
import { useWeatherEffectRuntime } from '../runtime/weather/useWeatherEffectRuntime';
import { createAppShellMetadata, getCreateAppShellCssVars } from '../apps/ai-generator/metadata';
import { setCreateAppEditServerId } from '../apps/ai-generator/moabomCreateAppEditSession';
import {
  buildSyntheticGeneratedLibraryApp,
  isGeneratedLibraryAppId,
} from '../apps/generatedAppLibrary';
import {
  isMoaShellLegalPageAppId,
  MOA_SHELL_LEGAL_PAGE_PRIVACY_APP_ID,
  MOA_SHELL_LEGAL_PAGE_TERMS_APP_ID,
  type MoaShellLegalPageSlug,
} from '../shell/moaShellLegalPageIds';
import { moabomBackgroundImageCssValue } from '../utils/moBackgroundAssets';
import { useMoabomServerPullTriggers } from '../utils/useMoabomServerPullTriggers';
import {
  formatShellPath,
  formatShellPathForWindow,
  parseShellRoute,
  pushShellPath,
  replaceShellPath,
} from '../utils/moabomShellRoutes';
import {
  buildFavoriteApps,
  buildMainApps,
  buildRecentApps,
  normalizeTaskbarItems,
  toTaskbarItem,
} from './home/moaHomeAppLists';
import {
  AUTH_WINDOW_APP_IDS,
  AUTH_WINDOW_HEIGHT,
  AUTH_WINDOW_WIDTH,
  BREAKPOINT_COMPACT_CONTROLS,
  BREAKPOINT_FULLSCREEN_WINDOW,
  BREAKPOINT_MOBILE_OVERLAY,
  BREAKPOINT_RIGHT_OVERLAY,
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  LEGAL_PAGE_WINDOW_HEIGHT,
  LEGAL_PAGE_WINDOW_WIDTH,
  MAX_OPEN_WINDOWS,
  MAX_RECENT_APPS,
  MAX_TASKBAR_ITEMS,
  MOA_HOME_EDGE,
  MOA_HOME_INNER,
  MOA_HOME_OVERLAY_EDGE,
  MOA_HOME_PANEL_WIDTH,
  MOA_SHELL_POINT_TITLE_GRADIENT,
  MOABOM_SHELL_SERVER_PULL_DEBOUNCE_MS,
  STORAGE_KEY_FAVORITES,
  STORAGE_KEY_ORDER,
  STORAGE_KEY_RECENT_APPS,
  STORAGE_KEY_TASKBAR_ICONS,
} from './home/moaHomeConstants';
import { loadJson, loadJsonSanitizedIds, saveJson } from './home/moaHomeStorage';
import { getResponsiveMode, getViewportWidth } from './home/moaHomeResponsive';
import { Moa_ShellWindowRenderer } from './home/Moa_ShellWindowRenderer';
import { pushInfoToast, pushWarningToast, showAppEditToast } from './home/moaHomeToasts';
import type { AuthUserLike, HomePageProps, MoaCurrentUser, ResponsiveMode, ShellUrlSync } from './home/moaHomeTypes';
import { buildMoaCurrentUser, isGuestOnlyAuthMode } from './home/moaHomeUser';
import {
  countOpenWindows,
  getCenteredWindowPosition,
  getNewWindowPosition,
} from './home/moaHomeWindowGeometry';

export type { HomePageProps } from './home/moaHomeTypes';
export const HomePage: React.FC<HomePageProps> = props => (
  <MoabomUiI18nProvider>
    <HomePageInner {...props} />
  </MoabomUiI18nProvider>
);

const HomePageInner: React.FC<HomePageProps> = ({ initialWindow }) => {
  const { t, language } = useMoabomShellT();
  const initialSystemState = loadMoabomSystemState();
  const [viewportWidth, setViewportWidth] = useState(() => getViewportWidth());
  const [responsiveMode, setResponsiveMode] = useState<ResponsiveMode>(() => getResponsiveMode(getViewportWidth()));
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [nextZIndex, setNextZIndex] = useState(1000);
  const [activeTab, setActiveTab] = useState<'basic' | 'user'>('basic');
  const [systemState, setSystemState] = useState<MoabomSystemState>(initialSystemState);
  const [modeIdx, setModeIdx] = useState(() => CENTER_MODE_TO_INDEX[initialSystemState.layout.centerMode]);
  const [leftOpen, setLeftOpen] = useState(() => getViewportWidth() > BREAKPOINT_MOBILE_OVERLAY && initialSystemState.layout.leftPanelOpen);
  const [rightOpen, setRightOpen] = useState(() => getViewportWidth() > BREAKPOINT_RIGHT_OVERLAY && initialSystemState.layout.rightPanelOpen);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<MoaCurrentUser | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [taskbarItems, setTaskbarItems] = useState<WindowState[]>(() => (
    normalizeTaskbarItems(loadJson<Partial<WindowState>[]>(STORAGE_KEY_TASKBAR_ICONS, []))
  ));
  /**
   * 관리자 측 플랫폼 defaults(`preferences.system_options` 포함) 를 보관해
   * `useEffectiveSystemOptions` 에 전달한다. 서버 pull 시점마다 동일 payload 에서 갱신된다.
   * 토스트/애니메이션 등 Runtime Effect 는 이 값 + systemState 를 합쳐 해석된다.
   */
  const [systemDefaults, setSystemDefaults] = useState<MoabomSystemDefaults | null>(null);

  // 편집모드
  const [editMode, setEditMode] = useState(false);
  // 드래그 중인 앱 (DragOverlay)
  const [activeApp, setActiveApp] = useState<App | null>(null);
  const weatherCanvasRef = useRef<HTMLCanvasElement>(null);
  const socialAuthHandledRef = useRef(false);
  const isLoggedInRef = useRef(false);
  const windowsRef = useRef<WindowState[]>([]);
  const taskbarItemsRef = useRef<WindowState[]>(taskbarItems);
  const initialWindowOpenedRef = useRef<AuthWindowMode | null>(null);

  useEffect(() => {
    isLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn]);

  const currentUserRef = useRef<MoaCurrentUser | null>(null);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const pullShellServerSnapshot = useCallback(async () => {
    const loggedIn = isLoggedInRef.current;
    const user = currentUserRef.current;
    if (loggedIn && !user?.memberKey) return null;
    return pullMoabomServerState({
      isLoggedIn: loggedIn,
      coreUserLanguage: user?.language ?? undefined,
      preserveShellPanelOpen: true,
    });
  }, []);

  useEffect(() => {
    windowsRef.current = windows;
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

  const updateSystemState = useCallback((patch: MoabomSystemStateMergePatch) => {
    setSystemState(() => {
      /** 마이페이지 등에서 저장한 preferences가 React state보다 최신일 수 있음 — 항상 디스크를 베이스로 병합 */
      const base = loadMoabomSystemState();
      const next = mergeMoabomSystemState(base, patch);
      saveMoabomSystemState(next);
      applyMoabomSystemAppearance(next.appearance);

      return next;
    });
  }, []);

  /** 마이페이지 등 다른 UI가 저장한 전체 상태를 셸과 동기화 */
  useEffect(() => {
    const sync = () => {
      setSystemState(prev => {
        const disk = loadMoabomSystemState();
        return areMoabomSystemStatesEqual(prev, disk) ? prev : disk;
      });
    };
    window.addEventListener(MOABOM_SYSTEM_STATE_CHANGED_EVENT, sync);
    return () => window.removeEventListener(MOABOM_SYSTEM_STATE_CHANGED_EVENT, sync);
  }, []);

  /**
   * 플랫폼 defaults + (로그인 시) 사용자 settings 를 서버와 맞춤. 게스트는 public/frontend-defaults.
   * currentUser.language 는 의존성에 넣지 않음 — 마이페이지 언어 저장 직후 레이스 방지.
   */
  useEffect(() => {
    if (isLoggedIn && !currentUser?.memberKey) return;

    let cancelled = false;
    void (async () => {
      const pulled = await pullShellServerSnapshot();
      if (cancelled || !pulled) return;
      setSystemState(pulled.state);
      setSystemDefaults(pulled.defaults);
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, currentUser?.memberKey, pullShellServerSnapshot]);

  useMoabomServerPullTriggers(
    async () => {
      const pulled = await pullShellServerSnapshot();
      if (pulled) {
        setSystemState(pulled.state);
        setSystemDefaults(pulled.defaults);
      }
    },
    {
      debounceMs: MOABOM_SHELL_SERVER_PULL_DEBOUNCE_MS,
      onFocus: true,
      onVisible: true,
    },
  );

  /**
   * Req 2.1 — Effective_Option_Value 를 구독하고 DOM 에 동기화한다.
   * - `animation` 값을 `applyMoabomAnimationRuntime` 으로 `<html data-moa-animations>` 에 기록.
   *
   * 주의: animation off 는 **오직 animation 효과(transition/scroll-behavior/keyframes)** 만 끈다.
   * Window 의 glass blur · 배경 흐림 등 장식은 테마(flat-*) 에만 연동되며 animation 과 무관하다.
   */
  const effectiveSystemOptions = useEffectiveSystemOptions({ systemDefaults });
  useEffect(() => {
    applyMoabomAnimationRuntime(effectiveSystemOptions.animation !== false);
  }, [effectiveSystemOptions.animation]);

  /**
   * moabom-home-weather-effect — 홈 셸 날씨 효과 런타임(Task 8.2).
   *
   * `effective.weather && effective.animation` 이 true 이고 탭이 visible · 캔버스가 교차 중일 때만
   * Weather_Render_Loop 를 가동한다. 브라우저 Geolocation 을 우선 사용하고,
   * 권한 미동의·실패 시 IP geolocate 로 fallback 한다.
   */
  useWeatherEffectRuntime({
    canvasRef: weatherCanvasRef,
    effective: effectiveSystemOptions,
    systemDefaults,
  });

  useEffect(() => {
    applyMoabomSystemAppearance(systemState.appearance);
  }, [systemState.appearance]);

  useEffect(() => {
    if (!isLoggedIn) return;
    setWindows(prev =>
      prev.filter(w => !isGuestOnlyAuthMode(w.appId as AuthWindowMode)),
    );
    setTaskbarItems(prev =>
      prev.filter(w => !isGuestOnlyAuthMode(w.appId as AuthWindowMode)),
    );
  }, [isLoggedIn]);

  // 메인 그리드 — 한 판 (기본앱+유저앱 통합)
  const orderRef = useRef<string[]>(loadJsonSanitizedIds(STORAGE_KEY_ORDER, []));
  const [mainApps, setMainApps] = useState<App[]>(() => buildMainApps(orderRef.current));
  const mainAppsRef = useRef<App[]>(mainApps);

  // 즐겨찾기 앱 목록
  const favoriteIdsRef = useRef<string[]>(
    loadJsonSanitizedIds(STORAGE_KEY_FAVORITES, MY_APPS_DATA.favorites.map(app => app.id)),
  );
  const [favoriteApps, setFavoriteApps] = useState<App[]>(() => buildFavoriteApps(favoriteIdsRef.current));
  const recentAppIdsRef = useRef<string[]>(
    loadJsonSanitizedIds(STORAGE_KEY_RECENT_APPS, []).slice(0, MAX_RECENT_APPS),
  );
  const [recentApps, setRecentApps] = useState<App[]>(() => buildRecentApps(recentAppIdsRef.current));

  useEffect(() => {
    const updateViewport = () => {
      const width = getViewportWidth();
      setViewportWidth(width);
      setResponsiveMode(getResponsiveMode(width));
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    const G7Core = (window as any).G7Core;
    const syncToasts = (state?: Record<string, any>) => {
      const nextToasts = Array.isArray(state?.toasts) ? state.toasts : [];
      setToasts(nextToasts);
    };

    syncToasts(G7Core?.state?.get?.());

    if (G7Core?.state?.subscribe) {
      return G7Core.state.subscribe(syncToasts);
    }
  }, []);

  useEffect(() => {
    mainAppsRef.current = mainApps;
  }, [mainApps]);

  const appsById = useMemo(() => {
    const m = new Map<string, App>();
    APPS.forEach(a => { m.set(a.id, a); });
    mainApps.forEach(a => { m.set(a.id, a); });
    m.set(createAppShellMetadata.id, createAppShellMetadata);
    return m;
  }, [mainApps]);

  const resolveWinTitle = useCallback(
    (win: WindowState) => resolveWindowTitle(win, appsById, language, t, AUTH_WINDOW_APP_IDS),
    [appsById, language, t],
  );

  useEffect(() => {
    const resizeWeatherCanvas = () => {
      const canvas = weatherCanvasRef.current;
      if (!canvas) return;

      // WeatherEffectEngine 이 ctx.setTransform(dpr) 로 DPR 을 적용하므로
      // backing store 는 논리 뷰포트 크기만 설정한다(이중 DPR 방지).
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeWeatherCanvas();
    window.addEventListener('resize', resizeWeatherCanvas);
    return () => window.removeEventListener('resize', resizeWeatherCanvas);
  }, []);

  /** 반응 모드 전환 직후에만 오버레이 상태를 리셋 — 모바일에서 토글 시 layout 저장으로 인한 effect가 패널을 즉시 닫던 버그 방지 */
  const prevResponsiveModeRef = useRef<ResponsiveMode | null>(null);

  useEffect(() => {
    const prevMode = prevResponsiveModeRef.current;
    prevResponsiveModeRef.current = responsiveMode;
    const enteredNewMode = prevMode !== responsiveMode;

    if (responsiveMode === 'desktop') {
      setLeftOpen(systemState.layout.leftPanelOpen);
      setRightOpen(systemState.layout.rightPanelOpen);
      return;
    }

    if (responsiveMode === 'right-overlay') {
      setLeftOpen(systemState.layout.leftPanelOpen);
      if (enteredNewMode) {
        setRightOpen(false);
      }
      return;
    }

    if (enteredNewMode) {
      setLeftOpen(false);
      setRightOpen(false);
    }
  }, [responsiveMode, systemState.layout.leftPanelOpen, systemState.layout.rightPanelOpen]);

  const overlayActive = (responsiveMode === 'mobile-overlay' && (leftOpen || rightOpen))
    || (responsiveMode === 'right-overlay' && rightOpen);
  const isMobileOverlay = responsiveMode === 'mobile-overlay';

  useEffect(() => {
    document.body.classList.toggle('lock-scroll', overlayActive);
    return () => document.body.classList.remove('lock-scroll');
  }, [overlayActive]);

  useEffect(() => {
    document.body.classList.add('moa-home-active');
    return () => document.body.classList.remove('moa-home-active');
  }, []);

  // 인증 UI: 검증 성공 전에는 비로그인으로 표시(깜빡임 방지). 세션 만료 시 무효 토큰 제거.
  useEffect(() => {
    let cancelled = false;
    let verifyLocked = false;

    const applyAuthState = (authenticated: boolean, user: AuthUserLike | null) => {
      if (cancelled) return;
      if (authenticated && user) {
        setIsLoggedIn(true);
        setCurrentUser(buildMoaCurrentUser(user, t('moa_shell.common.user_fallback')));
        return;
      }
      setIsLoggedIn(false);
      setCurrentUser(null);
    };

    const clearStaleToken = () => {
      try {
        const G7Core = (window as any).G7Core;
        G7Core?.api?.removeToken?.();
      } catch { /* ignore */ }
    };

    const G7Core = (window as any).G7Core;
    const authManager = G7Core?.AuthManager?.getInstance?.();

    if (!authManager) {
      setIsLoggedIn(false);
      setCurrentUser(null);
      return () => {
        cancelled = true;
      };
    }

    const onAuthChange = (...args: any[]) => {
      const state = args[0];
      applyAuthState(!!state?.isAuthenticated && !!state?.user, state?.user ?? null);
    };
    authManager.on('authStateChange', onAuthChange);

    const runInitialVerification = async () => {
      if (authManager.isAuthenticated() && authManager.getUser()) {
        applyAuthState(true, authManager.getUser());
        return;
      }

      const token = typeof G7Core?.api?.getToken === 'function' ? G7Core.api.getToken() : localStorage.getItem('auth_token');
      if (!token) {
        applyAuthState(false, null);
        return;
      }

      if (verifyLocked) return;
      verifyLocked = true;
      try {
        const ok = await authManager.checkAuth('user');
        if (cancelled) return;
        if (ok && authManager.getUser()) {
          applyAuthState(true, authManager.getUser());
          return;
        }
        clearStaleToken();
        applyAuthState(false, null);
      } finally {
        verifyLocked = false;
      }
    };

    void runInitialVerification();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── 저장 헬퍼 ──
  const saveOrder = useCallback((apps: App[]) => {
    const ids = apps.map(a => a.id);
    orderRef.current = ids;
    saveJson(STORAGE_KEY_ORDER, ids);
  }, []);

  const saveFavorites = useCallback((favoriteIds: string[]) => {
    favoriteIdsRef.current = favoriteIds;
    saveJson(STORAGE_KEY_FAVORITES, favoriteIds);
    setFavoriteApps(buildFavoriteApps(favoriteIds));
  }, []);

  const recordRecentApp = useCallback((app: App) => {
    if (app.id === 'mypage') return;

    const next = [app.id, ...recentAppIdsRef.current.filter(id => id !== app.id)].slice(0, MAX_RECENT_APPS);
    recentAppIdsRef.current = next;
    saveJson(STORAGE_KEY_RECENT_APPS, next);
    setRecentApps(buildRecentApps(next));
  }, []);

  const restoreTaskbarWindow = useCallback((id: string) => {
    const item = taskbarItemsRef.current.find(w => w.id === id);
    if (!item) return;

    if (item.appId === createAppShellMetadata.id) {
      setCreateAppEditServerId(item.editGeneratedAppId);
    }

    const alreadyOpen = windowsRef.current.find(w => w.id === id || w.appId === item.appId);
    if (alreadyOpen) {
      pushShellPath(formatShellPathForWindow(alreadyOpen));
      setTaskbarItems(prev => prev.filter(w => w.id !== id));
      setWindows(prev => prev.map(w => (w.id === alreadyOpen.id
        ? {
            ...w,
            zIndex: nextZIndex,
            isMinimized: false,
            ...(w.appId === 'mypage' ? { gradient: MOA_SHELL_POINT_TITLE_GRADIENT } : {}),
          }
        : w)));
      setNextZIndex(z => z + 1);
      return;
    }

    if (countOpenWindows(windowsRef.current) >= MAX_OPEN_WINDOWS) {
      pushWarningToast(t('moa_shell.home.toast_max_windows', { max: MAX_OPEN_WINDOWS }));
      return;
    }

    pushShellPath(formatShellPathForWindow(item));
    setTaskbarItems(prev => prev.filter(w => w.id !== id));
    setWindows(prev => [
      ...prev,
      {
        ...item,
        ...(item.appId === 'mypage' ? { gradient: MOA_SHELL_POINT_TITLE_GRADIENT } : {}),
        zIndex: nextZIndex,
        isMaximized: false,
        isMinimized: false,
      },
    ]);
    setNextZIndex(z => z + 1);
  }, [nextZIndex, t]);

  // ── 윈도우 관리 (openMyPage → openAuthWindow → openApp 순: 마이페이지 위임)
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

    // URL을 setState보다 먼저 반영 — 지연 push 시 자식 마이페이지의 첫 replaceShellPath가
    // 이전 히스토리 엔트리(방금까지 켜 둔 앱 URL)를 덮어써 스택에서 앱이 사라지는 버그 방지
    if (!sync.skipUrl) {
      const nextPath = formatShellPath({ kind: 'me', tab: initialTab });
      if (existing) {
        replaceShellPath(nextPath);
      } else {
        pushShellPath(nextPath);
      }
    }

    setWindows(prev => {
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

      const position = getCenteredWindowPosition(DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT);
      return [...prev, {
        id: `${myPageApp.id}-${Date.now()}`,
        appId: myPageApp.id,
        title: myPageApp.name,
        icon: myPageApp.icon,
        gradient: MOA_SHELL_POINT_TITLE_GRADIENT,
        zIndex: nextZIndex,
        ...position,
        isMaximized: false,
        isMinimized: false,
        myPageInitialTab: initialTab,
      }];
    });
    setNextZIndex(z => z + 1);
  }, [nextZIndex, restoreTaskbarWindow, t]);

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
      pushShellPath(formatShellPath({ kind: 'auth', mode }));
    }

    setNextZIndex(currentZIndex => {
      setWindows(prev => {
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
          isMaximized: false,
          isMinimized: false,
        }];
      });

      return currentZIndex + 1;
    });
  }, [isLoggedIn, restoreTaskbarWindow, t]);

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
    if (!sync.skipUrl) {
      pushShellPath(formatShellPath({
        kind: 'app',
        appId: app.id,
        editGeneratedAppId,
      }));
    }

    const { name: resolvedTitle } = resolveAppStrings(app, language);
    setWindows(prev => {
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
        isMaximized: false,
        isMinimized: false,
        editGeneratedAppId,
        ...position,
      }];
    });
    setNextZIndex(z => z + 1);
  }, [editMode, language, nextZIndex, restoreTaskbarWindow, t]);

  const openEditGeneratedApp = useCallback((serverId: number) => {
    openCreateAppShell({}, serverId);
  }, [openCreateAppShell]);

  const openApp = useCallback((app: App, sync: ShellUrlSync = {}) => {
    if (editMode) return;
    if (app.id === 'mypage') {
      openMyPage('profile', sync);
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
      restoreTaskbarWindow(minimized.id);
      return;
    }

    const openWindowCount = countOpenWindows(windowsRef.current);
    if (!existing && openWindowCount >= MAX_OPEN_WINDOWS) {
      pushWarningToast(t('moa_shell.home.toast_max_windows', { max: MAX_OPEN_WINDOWS }));
      return;
    }

    recordRecentApp(app);
    if (!sync.skipUrl) {
      pushShellPath(formatShellPath({ kind: 'app', appId: app.id }));
    }
    setWindows(prev => {
      const ex = prev.find(w => w.appId === app.id);
      if (ex) {
        return prev.map(w => w.id === ex.id ? { ...w, zIndex: nextZIndex, isMinimized: false } : w);
      }
      const position = getNewWindowPosition(DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT, countOpenWindows(prev));
      const { name: resolvedTitle } = resolveAppStrings(app, language);
      return [...prev, {
        id: `${app.id}-${Date.now()}`, appId: app.id, title: resolvedTitle, icon: app.icon,
        gradient: app.gradient, zIndex: nextZIndex, isMaximized: false, isMinimized: false,
        ...position,
      }];
    });
    setNextZIndex(z => z + 1);
  }, [editMode, nextZIndex, openCreateAppShell, openMyPage, recordRecentApp, restoreTaskbarWindow, t, language]);

  const updateLegalPageWindowTitle = useCallback((windowId: string, title: string) => {
    setWindows(prev => prev.map(w => (w.id === windowId ? { ...w, title } : w)));
  }, []);

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
        isMaximized: false,
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
        case 'home':
          setWindows([]);
          setCreateAppEditServerId(null);
          break;
        case 'auth': {
          if (isLoggedIn && isGuestOnlyAuthMode(route.mode)) {
            replaceShellPath('/');
            return;
          }
          openAuthWindow(route.mode, { skipUrl: true });
          break;
        }
        case 'me':
          openMyPage(route.tab, { skipUrl: true });
          break;
        case 'app': {
          if (route.appId === createAppShellMetadata.id) {
            openCreateAppShell({ skipUrl: true }, route.editGeneratedAppId);
            break;
          }
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
      }
    },
    [isLoggedIn, openApp, openAuthWindow, openCreateAppShell, openMyPage],
  );

  const shellRouteBootstrappedRef = useRef(false);
  useEffect(() => {
    if (shellRouteBootstrappedRef.current) return;
    shellRouteBootstrappedRef.current = true;
    const route = parseShellRoute(window.location.pathname, window.location.search);
    if (route.kind !== 'home') {
      applyShellRoute(route);
    }
  }, [applyShellRoute]);

  useEffect(() => {
    const onPop = () => {
      applyShellRoute(parseShellRoute(window.location.pathname, window.location.search));
    };
    // capture: 코어 Router의 popstate(버블)보다 먼저 실행 — 같은 home 레이아웃에서도
    // navigateToCurrentPath가 전체 레이아웃을 다시 그리기 전에 셸 윈도우·URL 상태를 맞춤.
    window.addEventListener('popstate', onPop, true);
    return () => window.removeEventListener('popstate', onPop, true);
  }, [applyShellRoute]);

  const closeAuthWindows = useCallback(() => {
    setWindows(prev => prev.filter(item => !(AUTH_WINDOW_APP_IDS as readonly string[]).includes(item.appId)));
    setTaskbarItems(prev => prev.filter(item => !(AUTH_WINDOW_APP_IDS as readonly string[]).includes(item.appId)));
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/auth')) {
      replaceShellPath('/');
    }
  }, []);

  const exchangeSocialAuthCode = useCallback(async (socialAuthCode: string) => {
    try {
      const response = await fetch('/api/modules/moabom-social-auth/exchange', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: socialAuthCode }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t('moa_shell.home.sns_login_failed'));
      }

      const G7Core = (window as any).G7Core;
      G7Core?.api?.setToken?.(payload.data.token);
      localStorage.setItem('auth_token', payload.data.token);

      const authManager = G7Core?.AuthManager?.getInstance?.();
      if (authManager?.checkAuth) {
        const authenticated = await authManager.checkAuth('user');
        const user = authenticated ? authManager.getUser() : payload.data.user;
        setIsLoggedIn(true);
        setCurrentUser(buildMoaCurrentUser(user, t('moa_shell.common.user_fallback')));
      } else {
        setIsLoggedIn(true);
        setCurrentUser(buildMoaCurrentUser(payload.data.user, t('moa_shell.common.user_fallback')));
      }

      setIsLoggedIn(true);
      closeAuthWindows();
      G7Core?.toast?.success?.(t('moa_shell.home.sns_login_success'), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('moa_shell.home.sns_login_failed');
      (window as any).G7Core?.toast?.error?.(message, 5000);
      if (!isLoggedInRef.current) {
        openAuthWindow('login');
      }
    }
  }, [closeAuthWindows, openAuthWindow, t]);

  useEffect(() => {
    const handleSocialAuthMessage = (data: SocialAuthPopupMessage) => {
      if (data.status === 'error') {
        (window as any).G7Core?.toast?.error?.(data.error || t('moa_shell.home.sns_login_failed'), 5000);
        if (!isLoggedInRef.current) {
          openAuthWindow('login');
        }
        return;
      }

      if (!data.code) {
        (window as any).G7Core?.toast?.error?.(t('moa_shell.home.sns_exchange_invalid'), 5000);
        if (!isLoggedInRef.current) {
          openAuthWindow('login');
        }
        return;
      }

      void exchangeSocialAuthCode(data.code);
    };

    return subscribeSocialAuthPopupMessages(handleSocialAuthMessage);
  }, [exchangeSocialAuthCode, openAuthWindow, t]);

  useEffect(() => {
    if (socialAuthHandledRef.current) return;
    socialAuthHandledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const socialAuthError = params.get('social_auth_error');
    const socialAuthCode = params.get('social_auth_code');

    if (!socialAuthError && !socialAuthCode) return;

    const cleanUrl = `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState({}, '', cleanUrl || '/');

    if (socialAuthError) {
      const G7Core = (window as any).G7Core;
      G7Core?.toast?.error?.(socialAuthError, 5000);
      if (!isLoggedInRef.current) {
        openAuthWindow('login');
      }
      return;
    }

    if (!socialAuthCode) return;

    void exchangeSocialAuthCode(socialAuthCode);
  }, [exchangeSocialAuthCode, openAuthWindow]);

  useEffect(() => {
    if (!initialWindow) return;
    if (initialWindowOpenedRef.current === initialWindow) return;
    if (isLoggedIn && isGuestOnlyAuthMode(initialWindow)) return;
    initialWindowOpenedRef.current = initialWindow;
    openAuthWindow(initialWindow);
  }, [initialWindow, openAuthWindow, isLoggedIn]);

  const closeWindow = (win: WindowState) => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const canonical = formatShellPathForWindow(win);
      const isMypage = win.appId === 'mypage';
      if (path === canonical || (isMypage && path.startsWith('/me'))) {
        replaceShellPath('/');
      }
    }
    setWindows(p => p.filter(w => w.id !== win.id));
  };
  const minimizeWindow = (id: string) => {
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
  };
  const toggleMaximize = (id: string) => setWindows(p => p.map(w => w.id === id ? { ...w, isMaximized: !w.isMaximized } : w));
  const focusWindow = (id: string) => {
    setWindows(p => p.map(w => w.id === id ? { ...w, zIndex: nextZIndex, isMinimized: false } : w));
    setNextZIndex(z => z + 1);
  };
  const minimizedWindows = taskbarItems;

  const toggleFavoriteApp = useCallback((appId: string) => {
    const current = favoriteIdsRef.current;
    const next = current.includes(appId)
      ? current.filter(id => id !== appId)
      : [...current, appId];

    saveFavorites(next);
  }, [saveFavorites]);

  // ── 편집모드 ──
  const handleEnterEditMode = useCallback(() => {
    setEditMode(true);
  }, []);

  const handleExitEditMode = useCallback(() => {
    setEditMode(false);
  }, []);

  // ── 앱 삭제 ──
  const handleDeleteApp = useCallback((appId: string) => {
    setMainApps(prev => {
      const next = prev.filter(a => a.id !== appId);
      saveOrder(next);
      return next;
    });
  }, [saveOrder]);

  const addAppToMain = useCallback((app: App): boolean => {
    const currentApps = mainAppsRef.current;
    if (currentApps.some(item => item.id === app.id)) {
      return false;
    }

    const next = [...currentApps, app];
    mainAppsRef.current = next;
    setMainApps(next);
    saveOrder(next);

    return true;
  }, [saveOrder]);

  const handleAddAppToMain = useCallback((app: App) => {
    const added = addAppToMain(app);
    showAppEditToast(
      added ? 'success' : 'warning',
      added ? t('moa_shell.home.toast_app_added') : t('moa_shell.home.toast_app_already'),
    );
  }, [addAppToMain, t]);

  // ── DndContext ──
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 4 } });
  const sensors = useSensors(pointerSensor);
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const pointerCollisions = pointerWithin(args);
    return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    const appId = id.startsWith('left-') ? id.replace('left-', '') : id;
    setActiveApp(APPS.find(a => a.id === appId) ?? null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveApp(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    if (activeId.startsWith('left-')) {
      const blockedPanelIds = new Set(['left-panel', 'right-panel']);
      if (event.collisions?.some(collision => blockedPanelIds.has(String(collision.id)))) return;

      const overId = String(over.id);
      const droppedOnMainGrid = overId === 'main-grid' || mainAppsRef.current.some(item => item.id === overId);
      if (!droppedOnMainGrid) return;

      const appId = activeId.replace('left-', '');
      const app = APPS.find(a => a.id === appId);
      if (!app) return;

      const added = addAppToMain(app);
      showAppEditToast(
        added ? 'success' : 'warning',
        added ? t('moa_shell.home.toast_app_added') : t('moa_shell.home.toast_app_already'),
      );
      return;
    }

    setMainApps(prev => {
      const oldIdx = prev.findIndex(a => a.id === active.id);
      const newIdx = prev.findIndex(a => a.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      const reordered = arrayMove(prev, oldIdx, newIdx);
      saveOrder(reordered);
      return reordered;
    });
  }, [addAppToMain, saveOrder, t]);

  // ── 레이아웃 ──
  const isRightOverlay = responsiveMode !== 'desktop';
  const compactWindow = viewportWidth <= BREAKPOINT_FULLSCREEN_WINDOW;
  const compactControls = viewportWidth <= BREAKPOINT_COMPACT_CONTROLS;
  /** 모바일 중앙 영역 등 기기 가장자리 인셋 (좌·우 슬라이드 패널과 별도) */
  /** ≤480px + 모바일 오버레이: 좌·우 패널만 화면 끝 flush·바깥 코너 직각 (`BREAKPOINT_COMPACT_CONTROLS`) */
  const overlayFlushEdges = isMobileOverlay && viewportWidth <= BREAKPOINT_COMPACT_CONTROLS;
  const overlayPanelWidth = isMobileOverlay
    ? Math.min(MOA_HOME_PANEL_WIDTH, Math.max(260, viewportWidth - 60))
    : MOA_HOME_PANEL_WIDTH;
  const leftPanelEdge = isMobileOverlay ? (overlayFlushEdges ? 0 : MOA_HOME_OVERLAY_EDGE) : MOA_HOME_EDGE;
  const rightPanelEdge = !isRightOverlay
    ? MOA_HOME_EDGE
    : isMobileOverlay
      ? (overlayFlushEdges ? 0 : MOA_HOME_OVERLAY_EDGE)
      : MOA_HOME_OVERLAY_EDGE;
  const centerEdge = isRightOverlay || isMobileOverlay ? MOA_HOME_OVERLAY_EDGE : MOA_HOME_EDGE;
  const leftOffset = leftOpen ? leftPanelEdge : -(overlayPanelWidth + leftPanelEdge);
  const rightOffset = rightOpen ? rightPanelEdge : -(overlayPanelWidth + rightPanelEdge);
  const centerLeft = isMobileOverlay ? centerEdge : leftOpen ? MOA_HOME_PANEL_WIDTH + MOA_HOME_EDGE + MOA_HOME_INNER : MOA_HOME_EDGE;
  const centerRight = isRightOverlay ? centerEdge : rightOpen ? MOA_HOME_PANEL_WIDTH + MOA_HOME_EDGE + MOA_HOME_INNER : MOA_HOME_EDGE;

  const handleShellAuthenticated = useCallback((user?: AuthUserLike | null) => {
    setIsLoggedIn(true);
    setCurrentUser(buildMoaCurrentUser(user, t('moa_shell.common.user_fallback')));
    closeAuthWindows();
  }, [closeAuthWindows, t]);

  const handleShellProfileUpdated = useCallback((user?: AuthUserLike | null) => {
    setCurrentUser(buildMoaCurrentUser(user ?? null, t('moa_shell.common.user_fallback')));
  }, [t]);

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

  const renderWindowContent = (win: WindowState) => (
    <Moa_ShellWindowRenderer
      win={win}
      t={t}
      compactWindow={compactWindow}
      currentUser={currentUser}
      favoriteApps={favoriteApps}
      recentApps={recentApps}
      resolveWinTitle={resolveWinTitle}
      onOpenApp={openApp}
      onEditGeneratedApp={openEditGeneratedApp}
      onOpenAuthWindow={openAuthWindow}
      onAuthenticated={handleShellAuthenticated}
      onProfileUpdated={handleShellProfileUpdated}
      onMyPageTabChange={handleMyPageTabChange}
      onLegalPageTitleResolved={updateLegalPageWindowTitle}
    />
  );

  return (
    <Div className={`moa-home-root relative w-full max-w-[100vw] overflow-hidden text-primary ${editMode ? 'is-editing' : ''}`}
      style={{
        backgroundImage: moabomBackgroundImageCssValue(systemState.appearance.backgroundImageId),
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>

      <Canvas
        ref={weatherCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      />

      <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <LeftPanel width={overlayPanelWidth} leftOffset={leftOffset} onOpenApp={openApp} activeTab={activeTab} onTabChange={setActiveTab}
          editMode={editMode} onEnterEditMode={handleEnterEditMode} favoriteApps={favoriteApps}
          onAddApp={handleAddAppToMain} isOverlay={isMobileOverlay} overlayFlushEdges={overlayFlushEdges} onClose={() => {
            setLeftOpen(false);
            updateSystemState({ layout: { leftPanelOpen: false } });
          }} />

        <CenterPanel centerLeft={centerLeft} centerRight={centerRight} leftOpen={leftOpen} rightOpen={rightOpen}
          onOpenMyPageSettings={() => openMyPage('settings')}
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
          modeIdx={modeIdx} onModeChange={(idx) => {
            setModeIdx(idx);
            updateSystemState({ layout: { centerMode: INDEX_TO_CENTER_MODE[idx] ?? 'moabom-apps' } });
          }} filteredApps={mainApps} onOpenApp={openApp}
          minimizedWindows={minimizedWindows} onFocusWindow={restoreTaskbarWindow}
          editMode={editMode} onEnterEditMode={handleEnterEditMode} onExitEditMode={handleExitEditMode}
          onDeleteApp={handleDeleteApp} compactControls={compactControls}
          appsById={appsById} authWindowAppIds={AUTH_WINDOW_APP_IDS} />

        <DragOverlay dropAnimation={null}>
          {activeApp ? (
            <Div className="flex flex-col items-center gap-2 pointer-events-none" style={{ opacity: 0.85 }}>
              <Div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center shadow-2xl" style={{ background: activeApp.gradient }}>
                <Icon name={activeApp.icon} className="text-white text-2xl drop-shadow" />
              </Div>
              <Div className="text-xs font-bold text-secondary text-center truncate w-[80px]">
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
            if (responsiveMode === 'mobile-overlay') {
              setLeftOpen(false);
              updateSystemState({ layout: { leftPanelOpen: false } });
            }
            setRightOpen(false);
              updateSystemState({ layout: { rightPanelOpen: false } });
          }}
        />
      )}

      <RightPanel width={overlayPanelWidth} rightOffset={rightOffset} isLoggedIn={isLoggedIn} currentUser={currentUser} onOpenMyPage={openMyPage}
        onOpenAuth={openAuthWindow}
        isOverlay={isRightOverlay} overlayFlushEdges={overlayFlushEdges} onClose={() => {
          setRightOpen(false);
              updateSystemState({ layout: { rightPanelOpen: false } });
        }} />

      {windows.map(win => {
        const isAuthWin = (AUTH_WINDOW_APP_IDS as readonly string[]).includes(win.appId);
        const isLegalPageWin = isMoaShellLegalPageAppId(win.appId);
        const isCreateAppShellWin = win.appId === createAppShellMetadata.id;
        return (
        <Window key={win.id} id={win.id} title={resolveWinTitle(win)} icon={win.icon} gradient={win.gradient} zIndex={win.zIndex}
          isFavorite={favoriteIdsRef.current.includes(win.appId)}
          initialX={isAuthWin ? undefined : win.initialX}
          initialY={isAuthWin ? undefined : win.initialY}
          isMaximized={win.isMaximized} isMinimized={win.isMinimized}
          onClose={() => closeWindow(win)} onMinimize={() => minimizeWindow(win.id)}
          onMaximize={() => toggleMaximize(win.id)} onFocus={() => focusWindow(win.id)}
          titleBarVariant={isCreateAppShellWin ? 'create-app' : 'default'}
          titleBarExtraStyle={isCreateAppShellWin ? getCreateAppShellCssVars() : undefined}
          onToggleFavorite={isAuthWin || isLegalPageWin || isCreateAppShellWin ? undefined : () => toggleFavoriteApp(win.appId)}
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
              : {})}>
          {renderWindowContent(win)}
        </Window>
      );
      })}

      <Toast toasts={toasts} position="bottom-center" duration={4000} />
    </Div>
  );
};
