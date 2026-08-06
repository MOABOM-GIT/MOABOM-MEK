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
 * 셸 SubTabBar — 전환 시 setActiveTab + onSelect, settled 도착 후 같은 탭 재클릭 시에도 onSelect.
 * (우측 패널 접속자/친구/알림 탭 진입·재클릭 갱신에 사용)
 */
export function useShellSubTabSelect<T extends string>(
  activeTab: T,
  settledTab: T,
  setActiveTab: (tab: T) => void,
  onSelect?: (tabId: T, reason: 'change' | 'reselect') => void,
): (tabId: string) => void {
  return useCallback((tabId: string) => {
    const next = tabId as T;
    if (next === activeTab) {
      if (next === settledTab) {
        onSelect?.(next, 'reselect');
      }
      return;
    }
    setActiveTab(next);
    onSelect?.(next, 'change');
  }, [activeTab, onSelect, setActiveTab, settledTab]);
}
