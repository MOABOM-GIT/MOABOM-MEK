import { useEffect } from 'react';
import {
  isMoabomWebSocketConnected,
  subscribeMoabomWebSocketConnectionChange,
} from '../runtime/moabomWebSocketConnection';
import { useMoabomPresenceContext } from './MoabomPresenceProvider';

interface UseMoabomPresenceOptions {
  connectTabActive: boolean;
  friendTabActive: boolean;
}

const TAB_POLL_MS = 30_000;

function useTabListPolling(
  active: boolean,
  refresh: () => Promise<void>,
): void {
  useEffect(() => {
    if (!active) {
      return;
    }

    void refresh();

    let timer: ReturnType<typeof setInterval> | undefined;

    const syncPolling = () => {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
      if (!isMoabomWebSocketConnected()) {
        timer = setInterval(() => {
          void refresh();
        }, TAB_POLL_MS);
      }
    };

    syncPolling();
    const unsubscribe = subscribeMoabomWebSocketConnectionChange(() => {
      syncPolling();
      if (isMoabomWebSocketConnected()) {
        void refresh();
      }
    });

    return () => {
      unsubscribe();
      if (timer !== undefined) {
        clearInterval(timer);
      }
    };
  }, [active, refresh]);
}

/** 우측 패널 — Provider heartbeat·revision 위에서 WS 끊김 시에만 탭별 목록 폴링 */
export function useMoabomPresence({
  connectTabActive,
  friendTabActive,
}: UseMoabomPresenceOptions) {
  const {
    summary,
    onlineUsers,
    friends,
    ownPresence,
    loadingOnline,
    loadingFriends,
    refreshOnline,
    refreshFriends,
    addFriend,
    acceptFriend,
    removeFriend,
  } = useMoabomPresenceContext();

  useTabListPolling(connectTabActive, refreshOnline);
  useTabListPolling(friendTabActive, refreshFriends);

  return {
    summary,
    onlineUsers,
    friends,
    ownPresence,
    loadingOnline,
    loadingFriends,
    refreshOnline,
    refreshFriends,
    addFriend,
    acceptFriend,
    removeFriend,
  };
}
