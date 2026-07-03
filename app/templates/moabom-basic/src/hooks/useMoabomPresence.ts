import { useEffect } from 'react';
import {
  isMoabomWebSocketConnected,
  subscribeMoabomWebSocketConnectionChange,
} from '../runtime/moabomWebSocketConnection';
import { whenMoabomBootPhaseAtLeast } from '../runtime/moabomShellBootPipeline';
import { useMoabomPresenceFriends, useMoabomPresenceOnline, useMoabomPresenceSummary } from './MoabomPresenceProvider';

interface UseMoabomPresenceOptions {
  connectTabActive: boolean;
  friendTabActive: boolean;
}

const TAB_POLL_MS = 30_000;

/**
 * 탭별 목록 갱신 — tertiary-idle 이후 탭 활성화 시 1회 fetch, WS 끊김 시 30초 폴링.
 */
function useTabListPolling(
  active: boolean,
  refresh: () => Promise<void>,
): void {
  useEffect(() => {
    if (!active) {
      return;
    }

    let timer: ReturnType<typeof setInterval> | undefined;
    let unsubscribeWs: (() => void) | undefined;
    let cancelBoot: (() => void) | undefined;

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

    cancelBoot = whenMoabomBootPhaseAtLeast('tertiary-idle', () => {
      void refresh();
      syncPolling();
      unsubscribeWs = subscribeMoabomWebSocketConnectionChange(() => {
        const wasPolling = timer !== undefined;
        syncPolling();
        if (wasPolling && isMoabomWebSocketConnected()) {
          void refresh();
        }
      });
    });

    return () => {
      cancelBoot?.();
      unsubscribeWs?.();
      if (timer !== undefined) {
        clearInterval(timer);
      }
    };
  }, [active, refresh]);
}

/** 우측 패널 — 탭 전환 시 목록 갱신, WS 끊김 시 탭별 폴링 */
export function useMoabomPresence({
  connectTabActive,
  friendTabActive,
}: UseMoabomPresenceOptions) {
  const { summary } = useMoabomPresenceSummary();
  const {
    onlineUsers,
    ownPresence,
    loadingOnline,
    refreshOnline,
  } = useMoabomPresenceOnline();
  const {
    friends,
    loadingFriends,
    refreshFriends,
    addFriend,
    acceptFriend,
    removeFriend,
  } = useMoabomPresenceFriends();

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
