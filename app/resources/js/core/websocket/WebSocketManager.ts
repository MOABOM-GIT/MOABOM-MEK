/// <reference types="vite/client" />
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { createLogger } from '../utils/Logger';

// Pusher를 window 객체에 등록 (Laravel Echo 필수)
declare global {
  interface Window {
    Pusher: typeof Pusher;
    Echo: Echo<'reverb'>;
  }
}

/**
 * WebSocket 채널 타입
 */
export type ChannelType = 'public' | 'private' | 'presence';

/**
 * WebSocket 구독 옵션
 */
export interface SubscriptionOptions {
  /** 채널 타입 (기본값: 'private') */
  channelType?: ChannelType;
}

/**
 * WebSocket 설정 인터페이스 (Blade에서 동적으로 전달)
 */
export interface WebSocketConfig {
  /** Reverb 앱 키 */
  appKey: string;
  /** WebSocket 호스트 (기본값: localhost) */
  host?: string;
  /** WebSocket 포트 (기본값: 80) */
  port?: number;
  /** 스키마 (http 또는 https, 기본값: https) */
  scheme?: 'http' | 'https';
  /** Private 채널 인증 엔드포인트 (기본값: /broadcasting/auth) */
  authEndpoint?: string;
}

/**
 * WebSocket 연결을 관리하는 싱글톤 매니저
 *
 * Laravel Reverb와 Laravel Echo를 사용하여 WebSocket 연결을 관리합니다.
 * 설정은 Blade 템플릿에서 동적으로 전달받습니다.
 */
const logger = createLogger('WebSocketManager');

type BroadcastAuthCallback = (error: Error | null, data: unknown) => void;

class WebSocketManager {
  private echo: Echo<'reverb'> | null = null;
  private subscriptions: Map<string, ReturnType<Echo<'reverb'>['channel']>> = new Map();
  private initialized = false;
  private config: WebSocketConfig | null = null;

  /**
   * WebSocket 설정을 지정합니다.
   * TemplateApp 초기화 시 호출됩니다.
   *
   * @param config WebSocket 설정
   */
  configure(config: WebSocketConfig): void {
    if (this.initialized) {
      logger.warn('[WebSocketManager] 이미 초기화되어 설정을 변경할 수 없습니다.');
      return;
    }
    this.config = config;
    logger.log('[WebSocketManager] 설정 완료:', {
      appKey: config.appKey ? '***' : '(없음)',
      host: config.host,
      port: config.port,
      scheme: config.scheme,
    });
  }

  /**
   * Sanctum 토큰을 매 요청 시점에 읽어 private/presence 채널 인증에 사용합니다.
   * 초기화 시점 스냅샷만 쓰면 로그인 직후 /api/broadcasting/auth 403 이 발생합니다.
   */
  private getBroadcastAuthHeaders(): Record<string, string> {
    if (typeof localStorage === 'undefined') {
      return { Accept: 'application/json' };
    }

    const authToken = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    return headers;
  }

  /**
   * Pusher client와 Echo authorizer가 동일한 Sanctum 인증 엔드포인트를 사용하도록 통합합니다.
   */
  private authorizeBroadcastChannel(
    authEndpoint: string,
    socketId: string,
    channelName: string,
    callback: BroadcastAuthCallback
  ): void {
    fetch(authEndpoint, {
      method: 'POST',
      headers: {
        ...this.getBroadcastAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        socket_id: socketId,
        channel_name: channelName,
      }),
      credentials: 'same-origin',
    })
      .then(async (response) => {
        if (!response.ok) {
          callback(new Error(`Broadcast auth failed (${response.status})`), null);
          return;
        }
        callback(null, await response.json());
      })
      .catch((error: unknown) => {
        callback(error instanceof Error ? error : new Error('Broadcast auth failed'), null);
      });
  }

  /**
   * 로그인·로그아웃 후 private/presence 구독이 새 토큰으로 재인증되도록 연결을 재수립합니다.
   */
  reconnectForAuthChange(): void {
    if (!this.initialized) {
      this.initialize();
      return;
    }

    this.disconnect();
    this.initialize();
  }

  /**
   * Echo 인스턴스를 초기화합니다.
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    // 설정 확인
    if (!this.config || !this.config.appKey) {
      logger.warn('[WebSocketManager] WebSocket 설정이 없습니다. initTemplateApp에서 websocket 옵션을 전달해주세요.');
      return;
    }

    const { appKey, host = 'localhost', port = 80, scheme = 'https', authEndpoint = '/api/broadcasting/auth' } = this.config;
    const numPort = Number(port) || 80;
    const useTLS = scheme === 'https';

    logger.log('[WebSocketManager] 연결 설정:', { host, port: numPort, scheme, useTLS, authEndpoint });

    window.Pusher = Pusher;

    const pusherOptions = {
      wsHost: host,
      wsPort: numPort,
      wssPort: numPort,
      forceTLS: useTLS,
      disableStats: true,
      enabledTransports: ['ws', 'wss'] as const,
      cluster: 'mt1', // 필수 옵션이지만 Reverb에서는 무시됨
      authEndpoint,
      auth: {
        headers: this.getBroadcastAuthHeaders(),
      },
      channelAuthorization: {
        endpoint: authEndpoint,
        transport: 'ajax',
        headersProvider: () => this.getBroadcastAuthHeaders(),
        customHandler: (
          params: { socketId?: string; socket_id?: string; channelName?: string; channel_name?: string },
          callback: BroadcastAuthCallback
        ) => {
          this.authorizeBroadcastChannel(
            authEndpoint,
            params.socketId ?? params.socket_id ?? '',
            params.channelName ?? params.channel_name ?? '',
            callback
          );
        },
      },
    };

    logger.log('[WebSocketManager] Pusher 옵션:', { ...pusherOptions, authEndpoint });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pusherClient = new Pusher(appKey, pusherOptions as any);

    // 연결 상태 디버깅을 위한 이벤트 리스너
    pusherClient.connection.bind('connecting', () => {
      logger.log('[WebSocketManager] 연결 시도 중...');
    });

    pusherClient.connection.bind('connected', () => {
      logger.log('[WebSocketManager] 연결 성공! Socket ID:', pusherClient.connection.socket_id);
    });

    pusherClient.connection.bind('failed', () => {
      logger.error('[WebSocketManager] 연결 실패 - WebSocket을 사용할 수 없습니다.');
    });

    pusherClient.connection.bind('error', (error: unknown) => {
      logger.error('[WebSocketManager] 연결 오류:', error);
    });

    pusherClient.connection.bind('state_change', (states: { previous: string; current: string }) => {
      logger.log(`[WebSocketManager] 상태 변경: ${states.previous} → ${states.current}`);
    });

    pusherClient.connection.bind('unavailable', () => {
      logger.error('[WebSocketManager] WebSocket 사용 불가 - 연결할 수 없습니다.');
    });

    pusherClient.connection.bind('disconnected', () => {
      logger.warn('[WebSocketManager] 연결이 끊어졌습니다.');
    });

    // 초기 연결 상태 로깅
    logger.log('[WebSocketManager] 초기 연결 상태:', pusherClient.connection.state);

    this.echo = new Echo({
      broadcaster: 'reverb',
      client: pusherClient,
      authorizer: (channel: { name: string }) => ({
        authorize: (socketId: string, callback: (error: Error | null, data: unknown) => void) => {
          this.authorizeBroadcastChannel(authEndpoint, socketId, channel.name, callback);
        },
      }),
    });

    // 명시적으로 연결 시작
    logger.log('[WebSocketManager] 연결 시작 시도...');
    pusherClient.connect();

    window.Echo = this.echo;
    this.initialized = true;
    logger.log('[WebSocketManager] Echo 초기화 완료');
  }

  /**
   * 채널을 구독하고 이벤트를 리스닝합니다.
   *
   * @param channel 채널명 (예: 'admin.dashboard')
   * @param event 이벤트명 (예: 'dashboard.stats.updated')
   * @param callback 이벤트 수신 시 호출될 콜백
   * @param options 구독 옵션
   * @returns 구독 키
   */
  subscribe(
    channel: string,
    event: string,
    callback: (data: unknown) => void,
    options: SubscriptionOptions = {}
  ): string {
    this.initialize();

    if (!this.echo) {
      logger.warn('[WebSocketManager] Echo가 초기화되지 않았습니다.');
      return '';
    }

    const { channelType = 'private' } = options;

    if (channelType !== 'public' && !this.getBroadcastAuthHeaders().Authorization) {
      logger.warn(`[WebSocketManager] 인증 토큰 없음 — ${channelType} 채널 구독 생략: ${channel}`);
      return '';
    }

    const subscriptionKey = `${channel}:${event}`;

    if (this.subscriptions.has(subscriptionKey)) {
      logger.log(`[WebSocketManager] 이미 구독 중: ${subscriptionKey}`);
      return subscriptionKey;
    }

    let channelInstance: ReturnType<Echo<'reverb'>['channel']>;
    switch (channelType) {
      case 'public':
        channelInstance = this.echo.channel(channel);
        break;
      case 'presence':
        channelInstance = this.echo.join(channel);
        break;
      default:
        channelInstance = this.echo.private(channel);
    }

    // Reverb 이벤트는 .으로 시작해야 함
    channelInstance.listen(`.${event}`, callback);
    this.subscriptions.set(subscriptionKey, channelInstance);

    logger.log(`[WebSocketManager] 구독 완료: ${subscriptionKey} (${channelType})`);

    return subscriptionKey;
  }

  /**
   * 구독을 해제합니다.
   *
   * Map 엔트리 제거 + Echo 채널의 listener 명시 해제.
   * Echo는 동일 채널을 재사용하므로 stopListening() 누락 시
   * 재subscribe 시 listener가 중복 누적되어 콜백이 여러 번 실행됩니다.
   *
   * @param subscriptionKey 구독 키 (형식: "channel:event")
   */
  unsubscribe(subscriptionKey: string): void {
    const channelInstance = this.subscriptions.get(subscriptionKey);
    if (!channelInstance) {
      return;
    }

    // subscriptionKey 형식: "channelName:eventName"
    // channelName이 ':'를 포함할 수 있으므로 마지막 ':' 기준 분리
    const lastColon = subscriptionKey.lastIndexOf(':');
    const eventName = lastColon >= 0 ? subscriptionKey.substring(lastColon + 1) : '';

    if (eventName) {
      try {
        // Reverb 이벤트는 '.'으로 시작해야 함 (subscribe와 동일)
        channelInstance.stopListening(`.${eventName}`);
      } catch (e) {
        logger.warn(`[WebSocketManager] stopListening 실패: ${subscriptionKey}`, e);
      }
    }

    this.subscriptions.delete(subscriptionKey);
    logger.log(`[WebSocketManager] 구독 해제: ${subscriptionKey}`);
  }

  /**
   * 특정 채널의 모든 구독을 해제합니다.
   *
   * @param channel 채널명
   */
  leaveChannel(channel: string): void {
    if (!this.echo) {
      return;
    }

    this.echo.leave(channel);

    // 해당 채널의 모든 구독 키 제거
    const keysToDelete: string[] = [];
    this.subscriptions.forEach((_, key) => {
      if (key.startsWith(`${channel}:`)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.subscriptions.delete(key));
    logger.log(`[WebSocketManager] 채널 구독 해제: ${channel}`);
  }

  /**
   * 모든 구독을 해제하고 연결을 종료합니다.
   */
  disconnect(): void {
    if (this.echo) {
      this.echo.disconnect();
      this.subscriptions.clear();
      this.initialized = false;
      logger.log('[WebSocketManager] 연결 종료');
    }
  }

  /**
   * Echo 인스턴스를 반환합니다.
   *
   * @returns Echo 인스턴스 또는 null
   */
  getEcho(): Echo<'reverb'> | null {
    return this.echo;
  }

  /**
   * 초기화 여부를 반환합니다.
   *
   * @returns 초기화 여부
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 설정 여부를 반환합니다.
   *
   * @returns 설정 여부
   */
  isConfigured(): boolean {
    return this.config !== null && !!this.config.appKey;
  }

  /**
   * 현재 활성 구독 수를 반환합니다.
   *
   * @returns 구독 수
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }
}

export const webSocketManager = new WebSocketManager();
export { WebSocketManager };
