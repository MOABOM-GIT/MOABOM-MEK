import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { APPS, type App } from '../../data/Moa_apps';
import type { MoabomSystemDefaults, MoabomSystemState } from '../../types/moabomSystem';
import { MY_APPS_DATA } from '../../data/Moa_mockData';
import {
  deleteGeneratedApp,
  fetchGeneratedApps,
  fetchSharedGeneratedApps,
  updateGeneratedAppShare,
} from '../../api/moabomAppsApi';
import { createAppShellMetadata } from '../../apps/ai-generator/metadata';
import {
  generatedAppLibraryId,
  isGeneratedLibraryAppId,
  mapStoredGeneratedAppToLibraryApp,
} from '../../apps/generatedAppLibrary';
import {
  loadCachedGeneratedLibraryApps,
  removeGeneratedAppFromLibraryCache,
  saveGeneratedAppLibraryCache,
} from '../../apps/generatedAppLibraryCache';
import { subscribeGeneratedAppSaved } from '../../apps/generatedAppEvents';
import { pullMoabomServerState } from '../../utils/moabomPullServerState';
import { useMoabomServerPullTriggers } from '../../utils/useMoabomServerPullTriggers';
import { persistMainAppOrder } from '../../utils/moabomShellOrderSaveQueue';
import {
  buildFavoriteApps,
  buildMyApps,
  buildRecentApps,
  dedupeAppsById,
} from '../../shell/moaShellAppLists';
import {
  loadInitialMainOrderSnapshot,
  materializeOrderForMutation,
  MOABOM_SHELL_ORDER_CHANGED_EVENT,
  orderIdsFromApps,
  pruneStaleGeneratedAppOrderIds,
  resolveMainAppsFromOrder,
  loadLocalMainAppOrder,
  hasLocalMainAppOrderCustomized,
  type MainAppOrderSnapshot,
} from '../../shell/moaShellAppOrder';
import {
  addMainUnpinnedGeneratedId,
  loadMainUnpinnedGeneratedIds,
  removeMainUnpinnedGeneratedId,
} from '../../shell/moaShellMainAppUnpinned';
import {
  MAX_RECENT_APPS,
  MOABOM_SHELL_SERVER_PULL_DEBOUNCE_MS,
  STORAGE_KEY_FAVORITES,
  STORAGE_KEY_RECENT_APPS,
} from '../../shell/moaShellLayoutConstants';
import { loadJsonSanitizedIds, saveJson } from '../../shell/moaShellLocalStorage';
import { pushWarningToast, showAppEditToast } from '../../runtime/moaShellToasts';
import type { MoaCurrentUser } from '../../shell/moaShellTypes';
import type { MoabomTranslateFn } from '../../i18n/moabomT';

export interface UseMoaHomeAppCatalogOptions {
  isLoggedIn: boolean;
  currentUser: MoaCurrentUser | null;
  isLoggedInRef: MutableRefObject<boolean>;
  t: MoabomTranslateFn;
  setSystemState: Dispatch<SetStateAction<MoabomSystemState>>;
  setSystemDefaults: Dispatch<SetStateAction<MoabomSystemDefaults | null>>;
  onGeneratedAppRemoved: (appId: string) => void;
}

export function useMoaHomeAppCatalog({
  isLoggedIn,
  currentUser,
  isLoggedInRef,
  t,
  setSystemState,
  setSystemDefaults,
  onGeneratedAppRemoved,
}: UseMoaHomeAppCatalogOptions) {
  const initialOrderSnapshot = loadInitialMainOrderSnapshot();
  const orderRef = useRef<string[]>(initialOrderSnapshot.order);
  const orderCustomizedRef = useRef<boolean>(initialOrderSnapshot.customized);
  const [mainApps, setMainApps] = useState<App[]>(() => {
    const cached = loadCachedGeneratedLibraryApps();
    return resolveMainAppsFromOrder(
      orderRef.current,
      cached.owned,
      cached.shared,
      orderCustomizedRef.current,
    );
  });
  const mainAppsRef = useRef<App[]>(mainApps);
  const createdAppsRef = useRef<App[]>([]);
  const sharedGeneratedAppsRef = useRef<App[]>([]);
  const libraryGeneratedAppsRef = useRef<App[]>([]);

  const favoriteIdsRef = useRef<string[]>(
    loadJsonSanitizedIds(STORAGE_KEY_FAVORITES, MY_APPS_DATA.favorites.map(app => app.id)),
  );
  const [favoriteApps, setFavoriteApps] = useState<App[]>(() => buildFavoriteApps(favoriteIdsRef.current));
  const recentAppIdsRef = useRef<string[]>(
    loadJsonSanitizedIds(STORAGE_KEY_RECENT_APPS, []).slice(0, MAX_RECENT_APPS),
  );
  const [recentApps, setRecentApps] = useState<App[]>(() => buildRecentApps(recentAppIdsRef.current));
  const [createdApps, setCreatedApps] = useState<App[]>(() => loadCachedGeneratedLibraryApps().owned);
  const [sharedGeneratedApps, setSharedGeneratedApps] = useState<App[]>(() => loadCachedGeneratedLibraryApps().shared);

  const libraryGeneratedApps = useMemo(
    () => dedupeAppsById([...createdApps, ...sharedGeneratedApps]),
    [createdApps, sharedGeneratedApps],
  );
  const leftPanelMyApps = useMemo(() => buildMyApps(createdApps), [createdApps]);

  useEffect(() => {
    mainAppsRef.current = mainApps;
  }, [mainApps]);

  useEffect(() => {
    createdAppsRef.current = createdApps;
    sharedGeneratedAppsRef.current = sharedGeneratedApps;
    libraryGeneratedAppsRef.current = libraryGeneratedApps;
  }, [createdApps, sharedGeneratedApps, libraryGeneratedApps]);

  const appsById = useMemo(() => {
    const m = new Map<string, App>();
    APPS.forEach(a => { m.set(a.id, a); });
    mainApps.forEach(a => { m.set(a.id, a); });
    libraryGeneratedApps.forEach(a => { m.set(a.id, a); });
    m.set(createAppShellMetadata.id, createAppShellMetadata);
    return m;
  }, [libraryGeneratedApps, mainApps]);

  const commitMainAppOrder = useCallback((
    nextOrder: string[],
    customized: boolean,
  ) => {
    orderRef.current = nextOrder;
    orderCustomizedRef.current = customized;
    const next = resolveMainAppsFromOrder(
      nextOrder,
      createdAppsRef.current,
      sharedGeneratedAppsRef.current,
      customized,
    );
    mainAppsRef.current = next;
    setMainApps(next);
    if (customized) {
      persistMainAppOrder(nextOrder, { isLoggedIn: isLoggedInRef.current });
    }
  }, [isLoggedInRef]);

  const applyMainAppOrderSnapshot = useCallback((
    snapshot: MainAppOrderSnapshot,
    ownedApps: App[] = createdAppsRef.current,
    catalogApps: App[] = sharedGeneratedAppsRef.current,
  ) => {
    orderRef.current = snapshot.order;
    orderCustomizedRef.current = snapshot.customized;
    const next = resolveMainAppsFromOrder(
      snapshot.order,
      ownedApps,
      catalogApps,
      snapshot.customized,
    );
    mainAppsRef.current = next;
    setMainApps(next);
  }, []);

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
  }, [isLoggedInRef]);

  useEffect(() => {
    if (isLoggedIn && !currentUser?.memberKey) return;

    let cancelled = false;
    void (async () => {
      const pulled = await pullShellServerSnapshot();
      if (cancelled || !pulled) return;
      setSystemState(pulled.state);
      setSystemDefaults(pulled.defaults);
      applyMainAppOrderSnapshot(pulled.mainAppOrder);
    })();

    return () => {
      cancelled = true;
    };
  }, [applyMainAppOrderSnapshot, isLoggedIn, currentUser?.memberKey, pullShellServerSnapshot, setSystemDefaults, setSystemState]);

  useMoabomServerPullTriggers(
    async () => {
      const pulled = await pullShellServerSnapshot();
      if (pulled) {
        setSystemState(pulled.state);
        setSystemDefaults(pulled.defaults);
        applyMainAppOrderSnapshot(pulled.mainAppOrder);
      }
    },
    {
      debounceMs: MOABOM_SHELL_SERVER_PULL_DEBOUNCE_MS,
      onFocus: true,
      onVisible: true,
    },
  );

  useEffect(() => {
    const syncOrderFromStorage = () => {
      const order = loadLocalMainAppOrder();
      const customized = hasLocalMainAppOrderCustomized();
      if (
        order.join('\0') === orderRef.current.join('\0')
        && customized === orderCustomizedRef.current
      ) {
        return;
      }
      applyMainAppOrderSnapshot({ order, customized });
    };

    window.addEventListener(MOABOM_SHELL_ORDER_CHANGED_EVENT, syncOrderFromStorage);
    return () => window.removeEventListener(MOABOM_SHELL_ORDER_CHANGED_EVENT, syncOrderFromStorage);
  }, [applyMainAppOrderSnapshot]);

  const pruneMainGeneratedApp = useCallback((appId: string) => {
    const prev = mainAppsRef.current;
    const nextOrder = materializeOrderForMutation(
      orderRef.current,
      prev,
      ids => ids.filter(id => id !== appId),
      orderCustomizedRef.current,
    );
    commitMainAppOrder(nextOrder, true);
  }, [commitMainAppOrder]);

  const upsertSharedGeneratedApp = useCallback((app: App) => {
    const nextShared = [app, ...sharedGeneratedAppsRef.current.filter(item => item.id !== app.id)];
    sharedGeneratedAppsRef.current = nextShared;
    libraryGeneratedAppsRef.current = dedupeAppsById([...createdAppsRef.current, ...nextShared]);
    setSharedGeneratedApps(nextShared);
    if (orderRef.current.includes(app.id)) {
      commitMainAppOrder(orderRef.current, true);
    }
  }, [commitMainAppOrder]);

  const removeSharedGeneratedAppOnly = useCallback((appId: string) => {
    const nextShared = sharedGeneratedAppsRef.current.filter(app => app.id !== appId);
    sharedGeneratedAppsRef.current = nextShared;
    libraryGeneratedAppsRef.current = dedupeAppsById([...createdAppsRef.current, ...nextShared]);
    setSharedGeneratedApps(nextShared);
  }, []);

  const upsertCreatedApp = useCallback((app: App, options?: { pinToMain?: boolean }) => {
    const nextCreated = [app, ...createdAppsRef.current.filter(item => item.id !== app.id)];
    createdAppsRef.current = nextCreated;
    libraryGeneratedAppsRef.current = dedupeAppsById([...nextCreated, ...sharedGeneratedAppsRef.current]);
    setCreatedApps(nextCreated);

    const prev = mainAppsRef.current;
    const alreadyOnMain = prev.some(item => item.id === app.id);
    const pinToMain = options?.pinToMain ?? !loadMainUnpinnedGeneratedIds().has(app.id);
    const nextOrder = materializeOrderForMutation(
      orderRef.current,
      prev,
      ids => {
        if (alreadyOnMain || !pinToMain) {
          return ids;
        }
        return [...ids, app.id];
      },
      orderCustomizedRef.current,
    );
    if (pinToMain || orderCustomizedRef.current) {
      commitMainAppOrder(nextOrder, pinToMain ? true : orderCustomizedRef.current);
    }

    if (Boolean((app.metadata as { isShared?: unknown } | undefined)?.isShared)) {
      upsertSharedGeneratedApp(app);
    } else {
      removeSharedGeneratedAppOnly(app.id);
    }
  }, [commitMainAppOrder, removeSharedGeneratedAppOnly, upsertSharedGeneratedApp]);

  const removeGeneratedAppFromShell = useCallback((appId: string) => {
    removeMainUnpinnedGeneratedId(appId);
    setCreatedApps(prev => prev.filter(app => app.id !== appId));
    setSharedGeneratedApps(prev => prev.filter(app => app.id !== appId));
    pruneMainGeneratedApp(appId);

    const nextFavoriteIds = favoriteIdsRef.current.filter(id => id !== appId);
    favoriteIdsRef.current = nextFavoriteIds;
    saveJson(STORAGE_KEY_FAVORITES, nextFavoriteIds);
    setFavoriteApps(prev => prev.filter(app => app.id !== appId));

    const nextRecentIds = recentAppIdsRef.current.filter(id => id !== appId);
    recentAppIdsRef.current = nextRecentIds;
    saveJson(STORAGE_KEY_RECENT_APPS, nextRecentIds);
    setRecentApps(prev => prev.filter(app => app.id !== appId));

    onGeneratedAppRemoved(appId);
  }, [onGeneratedAppRemoved, pruneMainGeneratedApp]);

  useEffect(() => subscribeGeneratedAppSaved((item) => {
    const app = mapStoredGeneratedAppToLibraryApp(item);
    removeMainUnpinnedGeneratedId(app.id);
    upsertCreatedApp(app, { pinToMain: true });
  }), [upsertCreatedApp]);

  useEffect(() => {
    setFavoriteApps(buildFavoriteApps(favoriteIdsRef.current, libraryGeneratedApps));
    setRecentApps(buildRecentApps(recentAppIdsRef.current, libraryGeneratedApps));
  }, [libraryGeneratedApps]);

  useEffect(() => {
    if (!isLoggedIn) {
      setCreatedApps([]);
    }

    let cancelled = false;
    void (async () => {
      try {
        const [ownedItems, sharedItems] = isLoggedIn
          ? await Promise.all([
              fetchGeneratedApps(),
              fetchSharedGeneratedApps(),
            ])
          : [[], await fetchSharedGeneratedApps()];
        if (cancelled) {
          return;
        }
        const ownedApps = ownedItems.map(mapStoredGeneratedAppToLibraryApp);
        const sharedApps = sharedItems.map(mapStoredGeneratedAppToLibraryApp);
        saveGeneratedAppLibraryCache(ownedItems, sharedItems);
        const libraryApps = dedupeAppsById([...ownedApps, ...sharedApps]);
        const prunedOrder = pruneStaleGeneratedAppOrderIds(orderRef.current, libraryApps);
        if (prunedOrder.length !== orderRef.current.length) {
          orderRef.current = prunedOrder;
          persistMainAppOrder(prunedOrder, { isLoggedIn: isLoggedInRef.current });
        }
        setCreatedApps(ownedApps);
        setSharedGeneratedApps(sharedApps);
        createdAppsRef.current = ownedApps;
        sharedGeneratedAppsRef.current = sharedApps;
        libraryGeneratedAppsRef.current = libraryApps;
        setMainApps(() => {
          const merged = resolveMainAppsFromOrder(
            orderRef.current,
            ownedApps,
            sharedApps,
            orderCustomizedRef.current,
          );
          mainAppsRef.current = merged;
          return merged;
        });
      } catch {
        if (!cancelled) {
          setCreatedApps([]);
          setSharedGeneratedApps([]);
          setMainApps(() => {
            const merged = resolveMainAppsFromOrder(
              orderRef.current,
              [],
              [],
              orderCustomizedRef.current,
            );
            mainAppsRef.current = merged;
            return merged;
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, currentUser?.memberKey, isLoggedInRef]);

  const saveFavorites = useCallback((favoriteIds: string[]) => {
    favoriteIdsRef.current = favoriteIds;
    saveJson(STORAGE_KEY_FAVORITES, favoriteIds);
    setFavoriteApps(buildFavoriteApps(favoriteIds, libraryGeneratedApps));
  }, [libraryGeneratedApps]);

  const recordRecentApp = useCallback((app: App) => {
    if (app.id === 'mypage') return;

    const next = [app.id, ...recentAppIdsRef.current.filter(id => id !== app.id)].slice(0, MAX_RECENT_APPS);
    recentAppIdsRef.current = next;
    saveJson(STORAGE_KEY_RECENT_APPS, next);
    setRecentApps(buildRecentApps(next, libraryGeneratedApps));
  }, [libraryGeneratedApps]);

  const toggleFavoriteApp = useCallback((appId: string) => {
    const current = favoriteIdsRef.current;
    const next = current.includes(appId)
      ? current.filter(id => id !== appId)
      : [...current, appId];
    saveFavorites(next);
  }, [saveFavorites]);

  const handleDeleteApp = useCallback((appId: string) => {
    if (isGeneratedLibraryAppId(appId)) {
      addMainUnpinnedGeneratedId(appId);
    }

    const prev = mainAppsRef.current;
    const nextOrder = materializeOrderForMutation(
      orderRef.current,
      prev,
      ids => ids.filter(id => id !== appId),
      orderCustomizedRef.current,
    );
    commitMainAppOrder(nextOrder, true);
  }, [commitMainAppOrder]);

  const addAppToMain = useCallback((app: App): boolean => {
    const currentApps = mainAppsRef.current;
    if (currentApps.some(item => item.id === app.id)) {
      return false;
    }

    if (isGeneratedLibraryAppId(app.id)) {
      removeMainUnpinnedGeneratedId(app.id);
    }

    const nextOrder = materializeOrderForMutation(
      orderRef.current,
      currentApps,
      ids => [...ids, app.id],
      orderCustomizedRef.current,
    );
    commitMainAppOrder(nextOrder, true);
    return true;
  }, [commitMainAppOrder]);

  const handleAddAppToMain = useCallback((app: App) => {
    const added = addAppToMain(app);
    showAppEditToast(
      added ? 'success' : 'warning',
      added ? t('moa_shell.home.toast_app_added') : t('moa_shell.home.toast_app_already'),
    );
  }, [addAppToMain, t]);

  const deleteSavedGeneratedApp = useCallback(async (serverId: number) => {
    const appId = generatedAppLibraryId(serverId);
    const appName = appsById.get(appId)?.name ?? `App #${serverId}`;
    if (!window.confirm(t('moa_shell.home.confirm_delete_generated', { name: appName }))) {
      return;
    }

    try {
      await deleteGeneratedApp(serverId);
      removeGeneratedAppFromLibraryCache(serverId);
      removeGeneratedAppFromShell(appId);
    } catch {
      pushWarningToast(t('moa_shell.home.toast_delete_generated_failed'));
    }
  }, [appsById, removeGeneratedAppFromShell, t]);

  const toggleGeneratedAppShare = useCallback(async (serverId: number, nextShared: boolean) => {
    try {
      const updated = await updateGeneratedAppShare(serverId, nextShared);
      const app = mapStoredGeneratedAppToLibraryApp(updated);
      upsertCreatedApp(app);
      showAppEditToast(
        'success',
        t(nextShared ? 'moa_shell.home.toast_share_generated_on' : 'moa_shell.home.toast_share_generated_off'),
      );
    } catch {
      pushWarningToast(t('moa_shell.home.toast_share_generated_failed'));
      throw new Error('share toggle failed');
    }
  }, [t, upsertCreatedApp]);

  const reorderMainApps = useCallback((reordered: App[]) => {
    commitMainAppOrder(orderIdsFromApps(reordered), true);
  }, [commitMainAppOrder]);

  return {
    mainApps,
    mainAppsRef,
    favoriteApps,
    favoriteIdsRef,
    recentApps,
    createdApps,
    sharedGeneratedApps,
    leftPanelMyApps,
    appsById,
    recordRecentApp,
    toggleFavoriteApp,
    handleDeleteApp,
    handleAddAppToMain,
    addAppToMain,
    deleteSavedGeneratedApp,
    toggleGeneratedAppShare,
    reorderMainApps,
  };
}
