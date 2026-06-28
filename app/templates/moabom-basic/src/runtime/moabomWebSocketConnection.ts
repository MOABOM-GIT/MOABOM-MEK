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
let bindRetryAttempt = 0;

const BIND_RETRY_BASE_MS = 200;
const BIND_RETRY_MAX_MS = 5_000;
const BIND_RETRY_MAX_ATTEMPTS = 24;

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

function clearBindRetryTimer(): void {
  if (bindRetryTimer !== null) {
    clearTimeout(bindRetryTimer);
    bindRetryTimer = null;
  }
}

function scheduleBindRetry(tryBind: () => void): void {
  clearBindRetryTimer();
  if (bindRetryAttempt >= BIND_RETRY_MAX_ATTEMPTS) {
    return;
  }

  const delayMs = Math.min(
    BIND_RETRY_MAX_MS,
    BIND_RETRY_BASE_MS * 2 ** Math.min(bindRetryAttempt, 5),
  );
  bindRetryAttempt += 1;
  bindRetryTimer = window.setTimeout(tryBind, delayMs);
}

function tryBindConnection(): void {
  const connection = readPusherConnection();
  if (!connection?.bind) {
    scheduleBindRetry(tryBindConnection);
    return;
  }

  clearBindRetryTimer();
  bindRetryAttempt = 0;
  bindConnectionEvents(connection);
}

/**
 * Pusher/Echo 초기화 전에도 리스너 등록이 유효하도록 연결 객체가 생길 때까지 재시도합니다.
 */
export function ensureMoabomWebSocketConnectionWatch(): void {
  if (watchInstalled) {
    if (!boundConnection) {
      refreshMoabomWebSocketConnectionWatch();
    }
    return;
  }
  watchInstalled = true;

  tryBindConnection();
}

export function refreshMoabomWebSocketConnectionWatch(): void {
  if (!watchInstalled) {
    return;
  }
  bindRetryAttempt = 0;
  tryBindConnection();
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
  clearBindRetryTimer();
  if (boundConnection && boundHandler) {
    boundConnection.unbind?.('state_change', boundHandler);
    boundConnection.unbind?.('connected', boundHandler);
    boundConnection.unbind?.('disconnected', boundHandler);
  }
  boundConnection = null;
  boundHandler = null;
  connectionListeners.clear();
  watchInstalled = false;
  bindRetryAttempt = 0;
}
