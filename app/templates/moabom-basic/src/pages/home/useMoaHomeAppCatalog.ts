import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { APPS, type App } from '../../data/Moa_apps';
import type { MoabomSystemDefaults, MoabomSystemState } from '../../types/moabomSystem';
import {
  clearValidatedGeneratedLibraryStorage,
  commitSavedGeneratedAppToLibrary,
  reconcileGeneratedLibraryFromServer,
  resolveGeneratedLibraryScopeKey,
  type GeneratedLibraryHydration,
} from '../../apps/generatedAppLibraryAuthority';
import {
  invalidateMoabomGeneratedAppLibraryCache,
  loadMoabomGeneratedAppLibrary,
} from '../../runtime/moabomGeneratedAppLibraryLoad';
import { removeGeneratedAppFromLibraryCache } from '../../apps/generatedAppLibraryCache';
import { subscribeGeneratedAppSaved } from '../../apps/generatedAppEvents';
import { deleteGeneratedApp, updateGeneratedAppShare } from '../../api/moabomAppsApi';
import { createAppShellMetadata } from '../../apps/ai-generator/metadata';
import {
  generatedAppLibraryId,
  isGeneratedLibraryAppId,
} from '../../apps/generatedAppLibrary';
import { pullMoabomServerState } from '../../utils/moabomPullServerState';
import { useMoabomServerPullTriggers } from '../../utils/useMoabomServerPullTriggers';
import { persistMainAppOrder } from '../../utils/moabomShellOrderSaveQueue';
import { queueSaveRecentAppIds } from '../../utils/moabomShellRecentAppsSaveQueue';
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
  resolveMainUnpinnedScopeKey,
  setActiveMainUnpinnedScopeKey,
} from '../../shell/moaShellMainAppUnpinned';
import {
  MAX_RECENT_APPS,
  MOABOM_SHELL_SERVER_PULL_DEBOUNCE_MS,
  STORAGE_KEY_FAVORITES,
  STORAGE_KEY_RECENT_APPS,
} from '../../shell/moaShellLayoutConstants';
import { loadJsonSanitizedIds, saveJson } from '../../shell/moaShellLocalStorage';
import { resolveGeneratedAppDisplayTitle } from '../../apps/generated/resolveGeneratedAppDisplayTitle';
import { buildShellAuthStateKey } from '../../shell/moaShellAuthStateKey';
import { confirmViaToast, pushWarningToast, showAppEditToast } from '../../runtime/moaShellToasts';
import type { MoaCurrentUser } from '../../shell/moaShellTypes';
import type { MoabomTranslateFn } from '../../i18n/moabomT';
import { MOABOM_SHELL_BOOT_LOADED_EVENT } from '../../i18n/moabomShellEvents';
import { getMoabomShellBootData } from '../../runtime/moabomShellBoot';
import { awaitMoabomBootPhaseAtLeast } from '../../runtime/moabomShellBootPipeline';

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
  const [libraryHydration, setLibraryHydration] = useState<GeneratedLibraryHydration>('idle');
  const [mainApps, setMainApps] = useState<App[]>(() => resolveMainAppsFromOrder(
    orderRef.current,
    [],
    [],
    orderCustomizedRef.current,
  ));
  const mainAppsRef = useRef<App[]>(mainApps);
  const createdAppsRef = useRef<App[]>([]);
  const sharedGeneratedAppsRef = useRef<App[]>([]);
  const libraryGeneratedAppsRef = useRef<App[]>([]);
  const libraryScopeRef = useRef<string | null>(null);

  const favoriteIdsRef = useRef<string[]>(
    loadJsonSanitizedIds(STORAGE_KEY_FAVORITES, []),
  );
  const [favoriteApps, setFavoriteApps] = useState<App[]>(() => buildFavoriteApps(favoriteIdsRef.current));
  const recentAppIdsRef = useRef<string[]>(
    loadJsonSanitizedIds(STORAGE_KEY_RECENT_APPS, []).slice(0, MAX_RECENT_APPS),
  );
  const [recentApps, setRecentApps] = useState<App[]>(() => buildRecentApps(recentAppIdsRef.current));
  const [createdApps, setCreatedApps] = useState<App[]>([]);
  const [sharedGeneratedApps, setSharedGeneratedApps] = useState<App[]>([]);

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

  const applyValidatedLibrary = useCallback((
    owned: App[],
    shared: App[],
    options?: { persistPrunedOrder?: boolean },
  ) => {
    const library = dedupeAppsById([...owned, ...shared]);
    const prunedOrder = pruneStaleGeneratedAppOrderIds(orderRef.current, library);
    if (prunedOrder.length !== orderRef.current.length) {
      orderRef.current = prunedOrder;
      if (options?.persistPrunedOrder !== false && orderCustomizedRef.current) {
        persistMainAppOrder(prunedOrder, {
          isLoggedIn: isLoggedInRef.current,
          customized: orderCustomizedRef.current,
        });
      }
    }

    createdAppsRef.current = owned;
    sharedGeneratedAppsRef.current = shared;
    libraryGeneratedAppsRef.current = library;
    setCreatedApps(owned);
    setSharedGeneratedApps(shared);

    const merged = resolveMainAppsFromOrder(
      orderRef.current,
      owned,
      shared,
      orderCustomizedRef.current,
    );
    mainAppsRef.current = merged;
    setMainApps(merged);
  }, [isLoggedInRef]);

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
      persistMainAppOrder(nextOrder, { isLoggedIn: isLoggedInRef.current, customized });
    }
  }, [isLoggedInRef]);

  const currentUserRef = useRef<MoaCurrentUser | null>(null);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    setActiveMainUnpinnedScopeKey(resolveMainUnpinnedScopeKey(
      isLoggedIn,
      currentUser?.memberKey,
    ));
  }, [isLoggedIn, currentUser?.memberKey]);

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

  const refreshMainAppsFromCurrentOrder = useCallback(() => {
    const merged = resolveMainAppsFromOrder(
      orderRef.current,
      createdAppsRef.current,
      sharedGeneratedAppsRef.current,
      orderCustomizedRef.current,
    );
    mainAppsRef.current = merged;
    setMainApps(merged);
  }, []);

  useEffect(() => {
    const onShellBootLoaded = () => {
      refreshMainAppsFromCurrentOrder();
    };

    window.addEventListener(MOABOM_SHELL_BOOT_LOADED_EVENT, onShellBootLoaded);
    if (getMoabomShellBootData()) {
      refreshMainAppsFromCurrentOrder();
    }

    return () => {
      window.removeEventListener(MOABOM_SHELL_BOOT_LOADED_EVENT, onShellBootLoaded);
    };
  }, [refreshMainAppsFromCurrentOrder]);

  useEffect(() => {
    if (isLoggedIn && !currentUser?.memberKey) return;

    let cancelled = false;
    void (async () => {
      await awaitMoabomBootPhaseAtLeast('shell-critical');
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
    const scopeKey = resolveGeneratedLibraryScopeKey(
      isLoggedInRef.current,
      currentUserRef.current?.memberKey,
    );
    const app = commitSavedGeneratedAppToLibrary(item, scopeKey);
    removeMainUnpinnedGeneratedId(app.id);
    upsertCreatedApp(app, { pinToMain: true });
    setLibraryHydration('ready');
  }), [isLoggedInRef, upsertCreatedApp]);

  useEffect(() => {
    setFavoriteApps(buildFavoriteApps(favoriteIdsRef.current, libraryGeneratedApps));
    setRecentApps(buildRecentApps(recentAppIdsRef.current, libraryGeneratedApps));
  }, [libraryGeneratedApps]);

  useEffect(() => {
    if (isLoggedIn && !currentUser?.memberKey) {
      return;
    }

    const scopeKey = resolveGeneratedLibraryScopeKey(isLoggedIn, currentUser?.memberKey);
    if (libraryScopeRef.current !== scopeKey) {
      libraryScopeRef.current = scopeKey;
      invalidateMoabomGeneratedAppLibraryCache();
    }
    let cancelled = false;

    if (!isLoggedIn) {
      setLibraryHydration('loading');
      applyValidatedLibrary([], [], { persistPrunedOrder: false });
    } else {
      setLibraryHydration(prev => (prev === 'ready' ? prev : 'loading'));
    }

    void (async () => {
      await awaitMoabomBootPhaseAtLeast('catalog-critical');
      if (cancelled) {
        return;
      }

      try {
        const { owned: ownedItems, shared: sharedItems } = await loadMoabomGeneratedAppLibrary(isLoggedIn);
        if (cancelled) {
          return;
        }
        const reconciled = reconcileGeneratedLibraryFromServer({
          ownedItems,
          sharedItems,
          scopeKey,
        });
        applyValidatedLibrary(reconciled.owned, reconciled.shared);
        if (!cancelled) {
          setLibraryHydration('ready');
        }
      } catch {
        if (!cancelled) {
          clearValidatedGeneratedLibraryStorage();
          applyValidatedLibrary([], []);
          setLibraryHydration('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyValidatedLibrary, isLoggedIn, currentUser?.memberKey, isLoggedInRef]);

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
    queueSaveRecentAppIds(next, isLoggedInRef.current);
  }, [isLoggedInRef, libraryGeneratedApps]);

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

  const deleteSavedGeneratedApp = useCallback(async (serverId: number, preferredTitle?: string) => {
    const appId = generatedAppLibraryId(serverId);
    const appName = await resolveGeneratedAppDisplayTitle({
      serverId,
      authStateKey: buildShellAuthStateKey(currentUserRef.current?.memberKey),
      catalogTitle: appsById.get(appId)?.name,
      preferredTitle,
      untitledLabel: t('moa_apps_ai.untitled_app'),
    });
    const confirmed = await confirmViaToast({
      message: t('moa_shell.home.confirm_delete_generated', { name: appName }),
      confirmLabel: t('common.delete'),
      type: 'warning',
    });
    if (!confirmed) {
      return;
    }

    try {
      await deleteGeneratedApp(serverId);
      removeGeneratedAppFromLibraryCache(serverId);
      invalidateMoabomGeneratedAppLibraryCache();
      removeGeneratedAppFromShell(appId);
    } catch {
      pushWarningToast(t('moa_shell.home.toast_delete_generated_failed'));
    }
  }, [appsById, removeGeneratedAppFromShell, t]);

  const toggleGeneratedAppShare = useCallback(async (serverId: number, nextShared: boolean) => {
    try {
      const updated = await updateGeneratedAppShare(serverId, nextShared);
      const scopeKey = resolveGeneratedLibraryScopeKey(
        isLoggedInRef.current,
        currentUserRef.current?.memberKey,
      );
      const app = commitSavedGeneratedAppToLibrary(updated, scopeKey);
      upsertCreatedApp(app);
      showAppEditToast(
        'success',
        t(nextShared ? 'moa_shell.home.toast_share_generated_on' : 'moa_shell.home.toast_share_generated_off'),
      );
    } catch {
      pushWarningToast(t('moa_shell.home.toast_share_generated_failed'));
      throw new Error('share toggle failed');
    }
  }, [isLoggedInRef, t, upsertCreatedApp]);

  const reorderMainApps = useCallback((reordered: App[]) => {
    commitMainAppOrder(orderIdsFromApps(reordered), true);
  }, [commitMainAppOrder]);

  return {
    mainApps,
    mainAppsRef,
    libraryHydration,
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
