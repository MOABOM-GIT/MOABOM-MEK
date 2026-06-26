import { useEffect } from 'react';
import {
  isMoabomWebSocketConnected,
  subscribeMoabomWebSocketConnectionChange,
} from '../runtime/moabomWebSocketConnection';
import { whenMoabomBootPhaseAtLeast } from '../runtime/moabomShellBootPipeline';
import { useMoabomPresenceContext } from './MoabomPresenceProvider';

interface UseMoabomPresenceOptions {
  connectTabActive: boolean;
  friendTabActive: boolean;
}

const TAB_POLL_MS = 30_000;

/**
 * 탭별 목록 폴링 — Provider secondary bootstrap 이후(tertiary-idle)에만 시작.
 * 초기 online/friends 는 Provider heartbeat 가 담당해 중복 fetch 를 막는다.
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
      syncPolling();
      unsubscribeWs = subscribeMoabomWebSocketConnectionChange(() => {
        syncPolling();
        if (isMoabomWebSocketConnected()) {
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
