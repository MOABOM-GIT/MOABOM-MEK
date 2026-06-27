import { useCallback, useEffect, useRef, useState } from 'react';
import { MOABOM_SHELL_SUB_TAB_TRANSITION_MS } from '../layout/moabomShellPanelLayout';

/**
 * SubTabBar 슬라이드(300ms) 완료 후 settledTab 갱신.
 * 마운트 시에는 지연 없이 activeTab 과 동기화한다.
 */
export function useShellSubTabSettle<T extends string>(activeTab: T): T {
  const [settledTab, setSettledTab] = useState(activeTab);
  const skipInitialDelayRef = useRef(true);

  useEffect(() => {
    if (skipInitialDelayRef.current) {
      skipInitialDelayRef.current = false;
      setSettledTab(activeTab);
      return;
    }

    const timer = window.setTimeout(() => {
      setSettledTab(activeTab);
    }, MOABOM_SHELL_SUB_TAB_TRANSITION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeTab]);

  return settledTab;
}

/**
 * 셸 SubTabBar — 전환 시 setActiveTab만, settled 도착 후 같은 탭 재클릭 시 onReselect.
 */
export function useShellSubTabSelect<T extends string>(
  activeTab: T,
  settledTab: T,
  setActiveTab: (tab: T) => void,
  onReselect?: (tabId: T) => void,
): (tabId: string) => void {
  return useCallback((tabId: string) => {
    const next = tabId as T;
    if (next === activeTab) {
      if (next === settledTab) {
        onReselect?.(next);
      }
      return;
    }
    setActiveTab(next);
  }, [activeTab, onReselect, setActiveTab, settledTab]);
}
