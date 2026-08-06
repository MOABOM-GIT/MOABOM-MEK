import { hasShellAccessToken } from '../api/moabomShellAccess';
import {
  isMoabomWebSocketConnected,
  refreshMoabomWebSocketConnectionWatch,
  subscribeMoabomWebSocketConnectionChange,
} from './moabomWebSocketConnection';

export const MOABOM_WEBSOCKET_AUTH_SYNCED_EVENT = 'moabom-websocket-auth-synced';

type G7WebSocketManager = {
  reconnectForAuthChange?: () => void;
  disconnect?: () => void;
  initialize?: () => void;
};

type AuthStatePayload = {
  isAuthenticated?: boolean;
};

function getWebSocketManager(): G7WebSocketManager | null {
  return (window as {
    G7Core?: { websocket?: { manager?: G7WebSocketManager } };
  }).G7Core?.websocket?.manager ?? null;
}

function getAuthManager(): {
  on?: (event: string, handler: (state: AuthStatePayload) => void) => void;
} | null {
  return (window as {
    G7Core?: { AuthManager?: { getInstance: () => { on?: (event: string, handler: (state: AuthStatePayload) => void) => void } } };
  }).G7Core?.AuthManager?.getInstance?.() ?? null;
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let lastSyncedAuth: boolean | null = null;
let pendingConnectedUnsub: (() => void) | null = null;
let pendingConnectedTimeout: number | null = null;

function dispatchAuthSyncedEvent(): void {
  refreshMoabomWebSocketConnectionWatch();
  window.dispatchEvent(new CustomEvent(MOABOM_WEBSOCKET_AUTH_SYNCED_EVENT));
}

function clearPendingConnectedWait(): void {
  if (pendingConnectedUnsub) {
    pendingConnectedUnsub();
    pendingConnectedUnsub = null;
  }
  if (pendingConnectedTimeout !== null) {
    clearTimeout(pendingConnectedTimeout);
    pendingConnectedTimeout = null;
  }
}

function dispatchAuthSyncedWhenReady(shouldConnect: boolean): void {
  clearPendingConnectedWait();

  if (!shouldConnect) {
    dispatchAuthSyncedEvent();
    return;
  }

  if (isMoabomWebSocketConnected()) {
    dispatchAuthSyncedEvent();
    return;
  }

  // 폴링 대신 connection change 구독 + 5s 상한
  pendingConnectedUnsub = subscribeMoabomWebSocketConnectionChange(() => {
    if (!isMoabomWebSocketConnected()) {
      return;
    }
    clearPendingConnectedWait();
    dispatchAuthSyncedEvent();
  });
  pendingConnectedTimeout = window.setTimeout(() => {
    clearPendingConnectedWait();
    dispatchAuthSyncedEvent();
  }, 5_000);
}

/**
 * 로그인·로그아웃 시 Echo/Pusher가 최신 Sanctum 토큰으로 재인증하도록 동기화합니다.
 * presence·알림 private 채널 403 방지 SSOT.
 */
export function syncMoabomWebSocketAuth(isAuthenticated?: boolean): void {
  const shouldConnect = isAuthenticated ?? hasShellAccessToken();

  if (syncTimer !== null) {
    clearTimeout(syncTimer);
  }

  syncTimer = setTimeout(() => {
    syncTimer = null;

    if (lastSyncedAuth === shouldConnect) {
      dispatchAuthSyncedWhenReady(shouldConnect);
      return;
    }
    lastSyncedAuth = shouldConnect;

    const manager = getWebSocketManager();
    if (!manager) {
      dispatchAuthSyncedWhenReady(shouldConnect);
      return;
    }

    if (!shouldConnect) {
      manager.disconnect?.();
      dispatchAuthSyncedWhenReady(false);
      return;
    }

    if (typeof manager.reconnectForAuthChange === 'function') {
      manager.reconnectForAuthChange();
    } else {
      manager.disconnect?.();
      manager.initialize?.();
    }

    dispatchAuthSyncedWhenReady(true);
  }, 80);
}

/**
 * G7 AuthManager authStateChange → WebSocket 재연결.
 * initTemplate 부트 시 1회 설치.
 */
export function installMoabomWebSocketAuthSync(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const authManager = getAuthManager();
  if (!authManager?.on) {
    return;
  }

  authManager.on('authStateChange', (state) => {
    syncMoabomWebSocketAuth(!!state?.isAuthenticated);
  });
}
