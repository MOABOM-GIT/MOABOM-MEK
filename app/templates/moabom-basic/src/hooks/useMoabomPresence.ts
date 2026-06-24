import { useEffect } from 'react';
import { useMoabomPresenceContext } from './MoabomPresenceProvider';

interface UseMoabomPresenceOptions {
  connectTabActive: boolean;
  friendTabActive: boolean;
}

/** 우측 패널 — Provider heartbeat 위에서 탭별 목록 폴링만 담당 */
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

  useEffect(() => {
    if (!connectTabActive) {
      return;
    }
    void refreshOnline();
    const timer = window.setInterval(() => {
      void refreshOnline();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [connectTabActive, refreshOnline]);

  useEffect(() => {
    if (!friendTabActive) {
      return;
    }
    void refreshFriends();
    const timer = window.setInterval(() => {
      void refreshFriends();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [friendTabActive, refreshFriends]);

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
