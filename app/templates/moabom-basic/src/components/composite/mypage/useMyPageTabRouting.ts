import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { parseShellPathname } from '../../../utils/moabomShellRoutes';
import { persistMyPageActiveTab, readPersistedMyPageActiveTab } from '../../../utils/moabomMypageTabPersist';
import { buildMyPageTabStructureForRouting } from './myPageMenuModel';
import type { MyPageMenuRow } from './myPageMenuModel';
import type { MyPageTab } from './myPageTypes';
import { isGuestEnabledTab, normalizeTab, reconcileMyPageTabFromShell } from './myPageUtils';

interface UseMyPageTabRoutingOptions {
  initialTab?: MyPageTab;
  isLoggedIn: boolean;
  menusFromDefaults: MyPageMenuRow[] | undefined;
  onActiveTabChange?: (tab: MyPageTab) => void;
}

export function useMyPageTabRouting({
  initialTab = 'profile',
  isLoggedIn,
  menusFromDefaults,
  onActiveTabChange,
}: UseMyPageTabRoutingOptions) {
  const onActiveTabChangeRef = useRef(onActiveTabChange);
  onActiveTabChangeRef.current = onActiveTabChange;

  const [activeTab, setActiveTab] = useState<MyPageTab>(() => {
    const fromPersist = readPersistedMyPageActiveTab();
    const normalized = normalizeTab(fromPersist ?? initialTab);
    return !isLoggedIn && !isGuestEnabledTab(normalized) ? 'settings' : normalized;
  });

  const tabStructureForRouting = useMemo(
    () => buildMyPageTabStructureForRouting(menusFromDefaults),
    [menusFromDefaults],
  );

  const tabStructureKey = useMemo(
    () => tabStructureForRouting.map(row => `${row.id}:${row.guestEnabled ? 1 : 0}`).join('|'),
    [tabStructureForRouting],
  );

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const lastReconcileKeyRef = useRef('');

  const isTabVisibleForUser = useCallback(
    (tabId: MyPageTab) =>
      tabStructureForRouting.some(
        row => row.id === tabId && (isLoggedIn || row.guestEnabled),
      ),
    [tabStructureForRouting, isLoggedIn],
  );

  useLayoutEffect(() => {
    const reconcileKey = `${initialTab ?? ''}::${isLoggedIn ? '1' : '0'}::${tabStructureKey}`;
    const current = activeTabRef.current;
    const desired = reconcileMyPageTabFromShell(initialTab, isLoggedIn, tabStructureForRouting);
    const currentVisible = isTabVisibleForUser(current);
    const needsTabUpdate = current !== desired || !currentVisible;
    const structureOrShellChanged = lastReconcileKeyRef.current !== reconcileKey;

    if (!needsTabUpdate && !structureOrShellChanged) {
      return;
    }

    lastReconcileKeyRef.current = reconcileKey;

    if (needsTabUpdate) {
      setActiveTab(desired);
      persistMyPageActiveTab(desired);
    }

    if (typeof window !== 'undefined') {
      const parsed = parseShellPathname(window.location.pathname);
      if (parsed.kind === 'me' && parsed.tab !== desired) {
        onActiveTabChangeRef.current?.(desired);
      }
    }
  }, [initialTab, isLoggedIn, tabStructureKey, tabStructureForRouting, isTabVisibleForUser]);

  const handleSelectTab = useCallback((tabId: MyPageTab) => {
    setActiveTab(tabId);
    persistMyPageActiveTab(tabId);
    onActiveTabChangeRef.current?.(tabId);
  }, []);

  return {
    activeTab,
    tabStructureForRouting,
    handleSelectTab,
  };
}
