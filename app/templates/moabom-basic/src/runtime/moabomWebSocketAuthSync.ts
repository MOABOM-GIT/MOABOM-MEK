import { hasShellAccessToken } from '../api/moabomShellAccess';

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

/**
 * 로그인·로그아웃 시 Echo/Pusher가 최신 Sanctum 토큰으로 재인증하도록 동기화합니다.
 * presence·알림 private 채널 403 방지 SSOT.
 */
export function syncMoabomWebSocketAuth(isAuthenticated?: boolean): void {
  const manager = getWebSocketManager();
  if (!manager) {
    return;
  }

  const shouldConnect = isAuthenticated ?? hasShellAccessToken();
  if (!shouldConnect) {
    manager.disconnect?.();
    window.dispatchEvent(new CustomEvent(MOABOM_WEBSOCKET_AUTH_SYNCED_EVENT));
    return;
  }

  if (typeof manager.reconnectForAuthChange === 'function') {
    manager.reconnectForAuthChange();
  } else {
    manager.disconnect?.();
    manager.initialize?.();
  }

  window.dispatchEvent(new CustomEvent(MOABOM_WEBSOCKET_AUTH_SYNCED_EVENT));
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
