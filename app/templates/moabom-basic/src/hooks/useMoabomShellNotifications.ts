import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchShellNotifications,
  fetchShellUnreadCount,
  deleteAllShellNotifications,
  markAllShellNotificationsRead,
  markShellNotificationRead,
  type ShellNotificationItem,
} from '../api/moabomShellNotificationsApi';
import {
  extractProfileUserUuidFromUrl,
  pushFriendAcceptConfirmToast,
  resolveFriendRequesterName,
} from '../shell/moabomFriendNotificationActions';
import {
  registerShellNotificationCacheListener,
  setShellNotificationCache,
} from '../shell/moabomShellNotificationBridge';
import { moabomT } from '../i18n/moabomT';
import { navigateMoabomNotificationUrl } from '../utils/moabomNotificationNavigateUrl';
import {
  isShellNotificationUnread,
  shellNotificationReadTimestamp,
} from '../utils/moabomShellNotificationUtils';
import { MOABOM_SHELL_NOTIFICATION_PANEL_PAGE_SIZE } from '../layout/moabomShellPanelLayout';
import { MOABOM_SHELL_UNREAD_SYNCED_EVENT } from '../runtime/moabomShellChatSyncService';

interface UseMoabomShellNotificationsOptions {
  isLoggedIn: boolean;
  alarmTabActive: boolean;
  newNotificationToastText: string;
  newNotificationOpenText: string;
}

export function useMoabomShellNotifications({
  isLoggedIn,
  alarmTabActive,
}: UseMoabomShellNotificationsOptions) {
  const [items, setItems] = useState<ShellNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(1);

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
      setShellNotificationCache([]);
      return;
    }

    setLoading(true);
    try {
      const result = await fetchShellNotifications(page, MOABOM_SHELL_NOTIFICATION_PANEL_PAGE_SIZE);
      if (!result.ok || !result.page) {
        if (!append) {
          setItems([]);
          setShellNotificationCache([]);
          setHasMore(false);
        }
        return;
      }

      pageRef.current = result.page.currentPage;
      setHasMore(result.page.hasMore);
      setItems(prev => {
        const nextItems = append ? [...prev, ...result.page!.items] : result.page!.items;
        if (!append) {
          setShellNotificationCache(nextItems);
        }
        return nextItems;
      });
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
      setItems(prev => {
        const next = prev.map(row => ({ ...row, read_at: row.read_at ?? readAt }));
        setShellNotificationCache(next);
        return next;
      });
      setUnreadCount(0);
    } finally {
      setMarkingAll(false);
    }
  }, [isLoggedIn, markingAll, unreadCount]);

  const deleteAll = useCallback(async () => {
    if (!isLoggedIn || deletingAll || items.length === 0) {
      return;
    }

    setDeletingAll(true);
    try {
      const ok = await deleteAllShellNotifications();
      if (!ok) {
        return;
      }
      setItems([]);
      setShellNotificationCache([]);
      setUnreadCount(0);
      setHasMore(false);
      pageRef.current = 1;
    } finally {
      setDeletingAll(false);
    }
  }, [deletingAll, isLoggedIn, items.length]);

  const openNotification = useCallback(async (item: ShellNotificationItem) => {
    if (isShellNotificationUnread(item.read_at)) {
      const ok = await markShellNotificationRead(item.id);
      if (ok) {
        const readAt = shellNotificationReadTimestamp();
        setItems(prev => {
          const next = prev.map(row => (row.id === item.id ? { ...row, read_at: readAt } : row));
          setShellNotificationCache(next);
          return next;
        });
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }

    if (item.type === 'friend_request') {
      const requesterUuid = extractProfileUserUuidFromUrl(item.url)
        ?? (typeof item.data?.requester_uuid === 'string' ? item.data.requester_uuid : null);
      const requesterName = resolveFriendRequesterName(item.subject, item.body, item.data ?? null)
        ?? moabomT('moa_chat.unknown_sender');
      if (requesterUuid) {
        pushFriendAcceptConfirmToast({
          requesterUuid,
          requesterName,
          t: moabomT,
        });
        return;
      }
    }

    navigateMoabomNotificationUrl(item.url, item.type, item.data ?? null);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setItems([]);
      setUnreadCount(0);
      setHasMore(false);
      setShellNotificationCache([]);
      return;
    }

    void refreshUnreadCount();
  }, [isLoggedIn, refreshUnreadCount]);

  useEffect(() => {
    if (!isLoggedIn) {
      return undefined;
    }
    return registerShellNotificationCacheListener(cached => {
      setItems(cached);
      void refreshUnreadCount();
    });
  }, [isLoggedIn, refreshUnreadCount]);

  useEffect(() => {
    if (!isLoggedIn) {
      return undefined;
    }
    const onUnreadSynced = (event: Event) => {
      const detail = (event as CustomEvent<{ count: number }>).detail;
      if (typeof detail?.count === 'number') {
        setUnreadCount(detail.count);
      }
    };
    window.addEventListener(MOABOM_SHELL_UNREAD_SYNCED_EVENT, onUnreadSynced);
    return () => window.removeEventListener(MOABOM_SHELL_UNREAD_SYNCED_EVENT, onUnreadSynced);
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || !alarmTabActive) {
      return;
    }
    void reloadList();
  }, [alarmTabActive, isLoggedIn, reloadList]);

  return {
    items,
    unreadCount,
    loading,
    markingAll,
    deletingAll,
    hasMore,
    markAllRead,
    deleteAll,
    openNotification,
    loadMore,
    reloadList,
  };
}
