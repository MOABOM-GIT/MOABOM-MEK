import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requestCatchUpSync = vi.fn();
const navigateNotification = vi.fn();
const dispatchNotification = vi.fn();

vi.mock('../moabomShellChatSyncService', () => ({
  requestShellChatCatchUpSync: requestCatchUpSync,
}));

vi.mock('../../utils/moabomNotificationNavigateUrl', () => ({
  navigateMoabomNotificationUrl: navigateNotification,
}));

vi.mock('../../shell/ShellRealtimeStore', () => ({
  dispatchShellNotificationReceived: dispatchNotification,
}));

describe('moabomFcmClient Service Worker bridge', () => {
  let originalServiceWorker: ServiceWorkerContainer;
  let messageHandler: ((event: MessageEvent) => void) | null;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    requestCatchUpSync.mockReset();
    navigateNotification.mockReset();
    dispatchNotification.mockReset();
    messageHandler = null;
    localStorage.clear();
    originalServiceWorker = navigator.serviceWorker;

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        addEventListener: vi.fn((type: string, handler: (event: MessageEvent) => void) => {
          if (type === 'message') {
            messageHandler = handler;
          }
        }),
      },
    });
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: originalServiceWorker,
    });
    window.history.replaceState({}, '', '/');
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('로그인 부트는 1회성 안내 CTA만 표시하고 사용자 클릭 전에는 권한을 요청하지 않는다', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission,
    });
    let shellState: Record<string, unknown> = {};
    const originalG7Core = (window as any).G7Core;
    (window as any).G7Core = {
      state: {
        update: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => {
          shellState = { ...shellState, ...updater(shellState) };
        },
      },
      toast: {},
    };

    try {
      const { registerMoabomFcmDeviceToken } = await import('../moabomFcmClient');
      await registerMoabomFcmDeviceToken();

      expect(requestPermission).not.toHaveBeenCalled();
      const toasts = shellState.toasts as Array<{ action?: { onClick?: () => Promise<void> } }>;
      expect(toasts).toHaveLength(1);
      await toasts[0]?.action?.onClick?.();
      expect(requestPermission).toHaveBeenCalledOnce();
    } finally {
      (window as any).G7Core = originalG7Core;
    }
  });

  it('FCM push 수신 시 알림 목록과 unread catch-up을 요청한다', async () => {
    const { installMoabomFcmServiceWorkerBridge } = await import('../moabomFcmClient');
    installMoabomFcmServiceWorkerBridge();

    messageHandler?.(new MessageEvent('message', {
      data: { type: 'MOABOM_FCM_PUSH_RECEIVED' },
    }));

    expect(requestCatchUpSync).toHaveBeenCalledOnce();
  });

  it('FCM payload에 권위 count가 있으면 REST 없이 바로 반영한다', async () => {
    const { installMoabomFcmServiceWorkerBridge } = await import('../moabomFcmClient');
    installMoabomFcmServiceWorkerBridge();

    messageHandler?.(new MessageEvent('message', {
      data: {
        type: 'MOABOM_FCM_PUSH_RECEIVED',
        subject: '새 메시지',
        body: '내용',
        notification_type: 'chat_message',
        click_url: '/users/example/chat',
        data: {
          event_id: 'notification-1',
          notification_id: 'notification-1',
          unread_count: '3',
        },
      },
    }));

    expect(dispatchNotification).toHaveBeenCalledWith(expect.objectContaining({
      id: 'notification-1',
      unread_count: 3,
      authoritative: true,
    }));
    expect(requestCatchUpSync).not.toHaveBeenCalled();
  });

  it('FCM 클릭을 전체 페이지 이동 없이 알림 패널과 같은 라우터로 전달한다', async () => {
    const { installMoabomFcmServiceWorkerBridge } = await import('../moabomFcmClient');
    installMoabomFcmServiceWorkerBridge();

    messageHandler?.(new MessageEvent('message', {
      data: {
        type: 'MOABOM_FCM_NOTIFICATION_CLICK',
        click_url: '/users/00000000-0000-4000-8000-000000000001/chat',
        notification_type: 'chat_message',
        data: { conversation_uuid: '00000000-0000-4000-8000-000000000002' },
      },
    }));

    expect(navigateNotification).toHaveBeenCalledWith(
      '/users/00000000-0000-4000-8000-000000000001/chat',
      'chat_message',
      { conversation_uuid: '00000000-0000-4000-8000-000000000002' },
    );
  });

  it('닫힌 앱에서 열린 landing query도 셸 내부 라우팅으로 소비한다', async () => {
    const payload = JSON.stringify({
      type: 'MOABOM_FCM_NOTIFICATION_CLICK',
      click_url: '/me/account',
      notification_type: 'welcome',
      data: {},
    });
    window.history.replaceState({}, '', `/?moabom_notification_click=${encodeURIComponent(payload)}`);

    const { installMoabomFcmServiceWorkerBridge } = await import('../moabomFcmClient');
    installMoabomFcmServiceWorkerBridge();
    vi.runAllTimers();

    expect(window.location.search).toBe('');
    expect(navigateNotification).toHaveBeenCalledWith('/me/account', 'welcome', {});
  });
});
