type PusherConnection = {
  state?: string;
  bind?: (event: string, callback: () => void) => void;
  unbind?: (event: string, callback: () => void) => void;
};

type ConnectionListener = () => void;

const connectionListeners = new Set<ConnectionListener>();
let watchInstalled = false;
let boundConnection: PusherConnection | null = null;
let boundHandler: (() => void) | null = null;
let bindRetryTimer: ReturnType<typeof setTimeout> | null = null;

function readPusherConnection(): PusherConnection | null {
  const manager = (window as unknown as {
    G7Core?: {
      websocket?: {
        manager?: {
          echo?: {
            connector?: {
              pusher?: {
                connection?: PusherConnection;
              };
            };
          };
        };
      };
    };
  }).G7Core?.websocket?.manager;

  return manager?.echo?.connector?.pusher?.connection ?? null;
}

function notifyConnectionListeners(): void {
  connectionListeners.forEach(listener => listener());
}

function bindConnectionEvents(connection: PusherConnection): void {
  if (boundConnection === connection && boundHandler) {
    return;
  }

  if (boundConnection && boundHandler) {
    boundConnection.unbind?.('state_change', boundHandler);
    boundConnection.unbind?.('connected', boundHandler);
    boundConnection.unbind?.('disconnected', boundHandler);
  }

  boundHandler = () => notifyConnectionListeners();
  boundConnection = connection;
  connection.bind?.('state_change', boundHandler);
  connection.bind?.('connected', boundHandler);
  connection.bind?.('disconnected', boundHandler);
}

/**
 * Pusher/Echo 초기화 전에도 리스너 등록이 유효하도록 연결 객체가 생길 때까지 재시도합니다.
 */
export function ensureMoabomWebSocketConnectionWatch(): void {
  if (watchInstalled) {
    return;
  }
  watchInstalled = true;

  const tryBind = () => {
    const connection = readPusherConnection();
    if (!connection?.bind) {
      bindRetryTimer = window.setTimeout(tryBind, 200);
      return;
    }
    bindRetryTimer = null;
    bindConnectionEvents(connection);
  };

  tryBind();
}

export function isMoabomWebSocketConnected(): boolean {
  return readPusherConnection()?.state === 'connected';
}

export function subscribeMoabomWebSocketConnectionChange(listener: ConnectionListener): () => void {
  ensureMoabomWebSocketConnectionWatch();
  connectionListeners.add(listener);
  return () => {
    connectionListeners.delete(listener);
  };
}

/** 테스트 전용 — watch 상태 초기화 */
export function resetMoabomWebSocketConnectionWatchForTest(): void {
  if (bindRetryTimer !== null) {
    clearTimeout(bindRetryTimer);
    bindRetryTimer = null;
  }
  if (boundConnection && boundHandler) {
    boundConnection.unbind?.('state_change', boundHandler);
    boundConnection.unbind?.('connected', boundHandler);
    boundConnection.unbind?.('disconnected', boundHandler);
  }
  boundConnection = null;
  boundHandler = null;
  connectionListeners.clear();
  watchInstalled = false;
}
