import { useEffect } from 'react';
import {
  isMoabomWebSocketConnected,
  subscribeMoabomWebSocketConnectionChange,
} from '../runtime/moabomWebSocketConnection';
import { whenMoabomBootPhaseAtLeast } from '../runtime/moabomShellBootPipeline';
import { setMoabomShellRealtimeDemand } from '../runtime/moabomShellRealtimeDemand';
import {
  useMoabomPresenceFriends,
  useMoabomPresenceOnline,
  useMoabomPresenceSummary,
  useMoabomPresenceSurfaceActive,
} from './MoabomPresenceProvider';

interface UseMoabomPresenceOptions {
  connectTabActive: boolean;
  friendTabActive: boolean;
}

const TAB_POLL_MS = 30_000;

/**
 * 탭별 목록 갱신 — WS 끊김 시에만 30초 폴링.
 * 탭 진입은 Provider active-surface effect, 같은 탭 재클릭은 RightPanel이 담당한다.
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
    let polledWhileDisconnected = false;

    const syncPolling = () => {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
      if (!isMoabomWebSocketConnected()) {
        polledWhileDisconnected = false;
        timer = setInterval(() => {
          polledWhileDisconnected = true;
          void refresh();
        }, TAB_POLL_MS);
      }
    };

    cancelBoot = whenMoabomBootPhaseAtLeast('tertiary-idle', () => {
      syncPolling();
      unsubscribeWs = subscribeMoabomWebSocketConnectionChange(() => {
        const needsCatchUp = polledWhileDisconnected && isMoabomWebSocketConnected();
        syncPolling();
        if (needsCatchUp) {
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
  const { setPresenceSurface } = useMoabomPresenceSurfaceActive();
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

  const presenceSurface = connectTabActive
    ? 'connect'
    : friendTabActive
      ? 'friend'
      : null;

  useEffect(() => {
    // 활성 탭 ID까지 전달해 숨겨진 목록을 함께 조회하지 않는다.
    setPresenceSurface(presenceSurface);
    setMoabomShellRealtimeDemand({ presence: presenceSurface !== null });
    return () => {
      setPresenceSurface(null);
      setMoabomShellRealtimeDemand({ presence: false });
    };
  }, [presenceSurface, setPresenceSurface]);

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
