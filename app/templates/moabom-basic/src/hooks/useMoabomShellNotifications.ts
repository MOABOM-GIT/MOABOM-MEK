import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchShellNotifications,
  fetchShellUnreadCount,
  markAllShellNotificationsRead,
  markShellNotificationRead,
  type ShellNotificationItem,
} from '../api/moabomShellNotificationsApi';
import { pushNotificationToast } from '../runtime/moaShellToasts';
import {
  subscribeShellNotificationChannel,
  unsubscribeShellNotificationChannel,
} from '../runtime/moabomShellNotificationSocket';
import { navigateMoabomNotificationUrl } from '../utils/moabomNotificationNavigateUrl';
import {
  isShellNotificationUnread,
  shellNotificationReadTimestamp,
} from '../utils/moabomShellNotificationUtils';

type AuthUserSnapshot = {
  uuid?: string;
};

function getAuthUserUuid(): string | null {
  const user = (window as { G7Core?: { AuthManager?: { getInstance: () => { getUser: () => AuthUserSnapshot | null } } } })
    .G7Core?.AuthManager?.getInstance?.()
    ?.getUser?.();
  return user?.uuid ?? null;
}

interface UseMoabomShellNotificationsOptions {
  isLoggedIn: boolean;
  alarmTabActive: boolean;
  newNotificationToastText: string;
  newNotificationOpenText: string;
}

export function useMoabomShellNotifications({
  isLoggedIn,
  alarmTabActive,
  newNotificationToastText,
  newNotificationOpenText,
}: UseMoabomShellNotificationsOptions) {
  const [items, setItems] = useState<ShellNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(1);
  const wsKeyRef = useRef('');
  const toastTextRef = useRef(newNotificationToastText);
  const toastOpenTextRef = useRef(newNotificationOpenText);
  const alarmTabActiveRef = useRef(alarmTabActive);

  useEffect(() => {
    toastTextRef.current = newNotificationToastText;
  }, [newNotificationToastText]);

  useEffect(() => {
    toastOpenTextRef.current = newNotificationOpenText;
  }, [newNotificationOpenText]);

  useEffect(() => {
    alarmTabActiveRef.current = alarmTabActive;
  }, [alarmTabActive]);

  const refreshUnreadCount = useCallback(async () => {
    if (!isLoggedIn) {
      setUnreadCount(0);
      return;
    }
    const count = await fetchShellUnreadCount();
    setUnreadCount(count);
  }, [isLoggedIn]);

  const loadPage = useCallback(async (page: number, append: boolean) => {
    if (!isLoggedIn) {
      setItems([]);
      setHasMore(false);
      return;
    }

    setLoading(true);
    try {
      const result = await fetchShellNotifications(page);
      if (!result.ok || !result.page) {
        if (!append) {
          setItems([]);
          setHasMore(false);
        }
        return;
      }

      pageRef.current = result.page.currentPage;
      setHasMore(result.page.hasMore);
      setItems(prev => (append ? [...prev, ...result.page!.items] : result.page!.items));
      await refreshUnreadCount();
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, refreshUnreadCount]);

  const reloadList = useCallback(async () => {
    pageRef.current = 1;
    await loadPage(1, false);
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) {
      return;
    }
    await loadPage(pageRef.current + 1, true);
  }, [hasMore, loadPage, loading]);

  const markAllRead = useCallback(async () => {
    if (!isLoggedIn || markingAll || unreadCount === 0) {
      return;
    }

    setMarkingAll(true);
    try {
      const ok = await markAllShellNotificationsRead();
      if (!ok) {
        return;
      }
      const readAt = shellNotificationReadTimestamp();
      setItems(prev => prev.map(row => ({ ...row, read_at: row.read_at ?? readAt })));
      setUnreadCount(0);
    } finally {
      setMarkingAll(false);
    }
  }, [isLoggedIn, markingAll, unreadCount]);

  const openNotification = useCallback(async (item: ShellNotificationItem) => {
    if (isShellNotificationUnread(item.read_at)) {
      const ok = await markShellNotificationRead(item.id);
      if (ok) {
        const readAt = shellNotificationReadTimestamp();
        setItems(prev => prev.map(row => (row.id === item.id ? { ...row, read_at: readAt } : row)));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }

    navigateMoabomNotificationUrl(item.url, item.type);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setItems([]);
      setUnreadCount(0);
      setHasMore(false);
      return;
    }

    void refreshUnreadCount();
  }, [isLoggedIn, refreshUnreadCount]);

  useEffect(() => {
    if (!isLoggedIn || !alarmTabActive) {
      return;
    }
    void reloadList();
  }, [alarmTabActive, isLoggedIn, reloadList]);

  useEffect(() => {
    if (!isLoggedIn) {
      if (wsKeyRef.current) {
        unsubscribeShellNotificationChannel(wsKeyRef.current);
        wsKeyRef.current = '';
      }
      return;
    }

    const uuid = getAuthUserUuid();
    if (!uuid) {
      return;
    }

    const subscriptionKey = subscribeShellNotificationChannel(uuid, (payload) => {
      const subject = payload.subject?.trim();
      void refreshUnreadCount();
      if (alarmTabActiveRef.current) {
        void reloadList();
      }

      const message = subject || toastTextRef.current;
      const navigateUrl = payload.url?.trim();
      if (navigateUrl) {
        pushNotificationToast(message, 2800, {
          label: toastOpenTextRef.current,
          onClick: () => navigateMoabomNotificationUrl(navigateUrl, payload.type),
        });
      } else {
        pushNotificationToast(message);
      }
    });

    if (subscriptionKey) {
      wsKeyRef.current = subscriptionKey;
    }

    return () => {
      if (wsKeyRef.current) {
        unsubscribeShellNotificationChannel(wsKeyRef.current);
        wsKeyRef.current = '';
      }
    };
  }, [isLoggedIn, refreshUnreadCount, reloadList]);

  return {
    items,
    unreadCount,
    loading,
    markingAll,
    hasMore,
    markAllRead,
    openNotification,
    loadMore,
    reloadList,
  };
}
