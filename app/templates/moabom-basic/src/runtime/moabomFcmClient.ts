/**
 * FCM 웹 토큰 등록 — Firebase 웹 SDK(CDN script) + moabom-fcm device-tokens API.
 * 설정이 없거나 미지원이면 no-op. Vite 번들에 firebase를 넣지 않는다.
 */
import { requestShellJson } from '../api/moabomShellHttp';
import { moabomT } from '../i18n/moabomT';
import { dispatchShellNotificationReceived } from '../shell/ShellRealtimeStore';
import { navigateMoabomNotificationUrl } from '../utils/moabomNotificationNavigateUrl';
import { MoabomRuntime } from './MoabomRuntime';
import { requestShellChatCatchUpSync } from './moabomShellChatSyncService';
import { dismissMoabomToast, enqueueMoabomToast } from './moabomToastEnqueue';

type FcmWebConfig = {
  enabled: boolean;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    messagingSenderId: string;
    appId: string;
  } | null;
  vapidKey: string | null;
};

type FirebaseCompatApp = {
  initializeApp: (config: Record<string, string>) => unknown;
  messaging: () => {
    getToken: (options?: {
      vapidKey?: string;
      serviceWorkerRegistration?: ServiceWorkerRegistration;
    }) => Promise<string>;
    isSupported?: () => Promise<boolean>;
  };
};

type MoabomFcmWorkerMessage = {
  type?: unknown;
  click_url?: unknown;
  notification_type?: unknown;
  subject?: unknown;
  body?: unknown;
  data?: unknown;
};

const FCM_PUSH_RECEIVED_MESSAGE = 'MOABOM_FCM_PUSH_RECEIVED';
const FCM_NOTIFICATION_CLICK_MESSAGE = 'MOABOM_FCM_NOTIFICATION_CLICK';
const FCM_NOTIFICATION_CLICK_PARAM = 'moabom_notification_click';
const FCM_PERMISSION_PRIMER_KEY = 'moabom:fcm-permission-primer:v1';

let registerInFlight: Promise<void> | null = null;
let serviceWorkerBridgeInstalled = false;
let permissionPrimerQueued = false;

function asNotificationData(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : null;
}

function applyFcmPush(message: MoabomFcmWorkerMessage): boolean {
  const data = asNotificationData(message.data);
  const eventId = typeof data?.event_id === 'string' ? data.event_id.trim() : '';
  const notificationId = typeof data?.notification_id === 'string'
    ? data.notification_id.trim()
    : eventId;
  const unreadRaw = data?.unread_count;
  const unreadCount = typeof unreadRaw === 'number'
    ? unreadRaw
    : typeof unreadRaw === 'string' && unreadRaw.trim() !== ''
      ? Number(unreadRaw)
      : Number.NaN;

  if (!notificationId || !Number.isFinite(unreadCount) || unreadCount < 0) {
    return false;
  }

  if (MoabomRuntime.getEffectiveOption('notification_center') === false) {
    return true;
  }

  dispatchShellNotificationReceived({
    id: notificationId,
    event_id: eventId || notificationId,
    type: typeof message.notification_type === 'string' ? message.notification_type : undefined,
    subject: typeof message.subject === 'string' ? message.subject : undefined,
    body: typeof message.body === 'string' ? message.body : undefined,
    url: typeof message.click_url === 'string' ? message.click_url : undefined,
    data,
    unread_count: unreadCount,
    authoritative: true,
    unreadAlreadySynced: true,
  });
  return true;
}

function openFcmNotification(message: MoabomFcmWorkerMessage): void {
  const clickUrl = typeof message.click_url === 'string' ? message.click_url.trim() : '';
  if (!clickUrl) {
    return;
  }

  navigateMoabomNotificationUrl(
    clickUrl,
    typeof message.notification_type === 'string' ? message.notification_type : null,
    asNotificationData(message.data),
  );
}

function consumeInitialFcmNotificationClick(): void {
  const currentUrl = new URL(window.location.href);
  const raw = currentUrl.searchParams.get(FCM_NOTIFICATION_CLICK_PARAM);
  if (!raw) {
    return;
  }

  currentUrl.searchParams.delete(FCM_NOTIFICATION_CLICK_PARAM);
  window.history.replaceState(
    window.history.state,
    '',
    `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
  );

  try {
    const message = JSON.parse(raw) as MoabomFcmWorkerMessage;
    window.setTimeout(() => openFcmNotification(message), 0);
  } catch {
    // 손상된 외부 클릭 payload 는 셸 라우팅에 전달하지 않음
  }
}

/**
 * PWA Service Worker의 FCM 수신·클릭을 열린 셸과 연결한다.
 * - push: WS private 구독 누락 시 REST unread/list catch-up
 * - click: 전체 문서 이동 없이 우측 알림 패널과 같은 셸 내부 라우팅
 */
export function installMoabomFcmServiceWorkerBridge(): void {
  if (
    serviceWorkerBridgeInstalled
    || typeof window === 'undefined'
    || !navigator.serviceWorker
  ) {
    return;
  }
  serviceWorkerBridgeInstalled = true;

  navigator.serviceWorker.addEventListener('message', (event: MessageEvent<MoabomFcmWorkerMessage>) => {
    const message = event.data;
    if (!message || typeof message !== 'object') {
      return;
    }

    if (message.type === FCM_PUSH_RECEIVED_MESSAGE) {
      if (!applyFcmPush(message)) {
        requestShellChatCatchUpSync();
      }
      return;
    }

    if (message.type === FCM_NOTIFICATION_CLICK_MESSAGE) {
      openFcmNotification(message);
    }
  });

  consumeInitialFcmNotificationClick();
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === '1') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`script_load_failed:${src}`)), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.loaded = '0';
    script.addEventListener('load', () => {
      script.dataset.loaded = '1';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`script_load_failed:${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

async function loadFirebaseCompat(): Promise<FirebaseCompatApp | null> {
  try {
    await loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
    const firebase = (window as unknown as { firebase?: FirebaseCompatApp }).firebase;
    return firebase ?? null;
  } catch {
    return null;
  }
}

async function fetchWebConfig(): Promise<FcmWebConfig | null> {
  try {
    return await requestShellJson<FcmWebConfig>(
      '/api/plugins/moabom-fcm/web-config',
      'none',
    );
  } catch {
    return null;
  }
}

function translatePrimer(key: string, fallback: string): string {
  const translated = moabomT(key);
  return translated === key ? fallback : translated;
}

function markPermissionPrimerHandled(): void {
  try {
    localStorage.setItem(FCM_PERMISSION_PRIMER_KEY, '1');
  } catch {
    // 저장소 차단 시 현재 세션의 중복만 방지합니다.
  }
}

function offerFcmPermissionPrimer(): void {
  if (permissionPrimerQueued) {
    return;
  }
  try {
    if (localStorage.getItem(FCM_PERMISSION_PRIMER_KEY) === '1') {
      return;
    }
  } catch {
    // 저장소 차단 시에도 현재 세션에서 한 번만 안내합니다.
  }

  let toastId: string | null = null;
  toastId = enqueueMoabomToast({
    id: 'moabom-fcm-permission-primer',
    type: 'info',
    severity: 'system',
    duration: 0,
    message: translatePrimer(
      'moa_mypage.notifications.permission_primer.message',
      '새 메시지와 답글을 놓치지 않도록 시스템 알림을 켜세요.',
    ),
    action: {
      label: translatePrimer('moa_mypage.notifications.permission_primer.action', '알림 켜기'),
      variant: 'primary',
      onClick: async () => {
        markPermissionPrimerHandled();
        permissionPrimerQueued = false;
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            await registerMoabomFcmDeviceToken({ userInitiated: true });
          }
        } catch {
          // 브라우저 정책·권한 오류는 셸 동작을 막지 않습니다.
        } finally {
          if (toastId) {
            dismissMoabomToast(toastId);
          }
        }
      },
    },
    onDismiss: () => {
      markPermissionPrimerHandled();
      permissionPrimerQueued = false;
    },
  });
  permissionPrimerQueued = toastId !== null;
}

/**
 * 이미 허용된 알림 권한으로 FCM 토큰을 서버에 등록한다.
 * 브라우저 권한 요청은 마이페이지 푸시 토글 또는 1회성 안내 CTA의 사용자 동작에서만 수행한다.
 */
export async function registerMoabomFcmDeviceToken(
  options: { userInitiated?: boolean } = {},
): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window) || !navigator.serviceWorker) {
    return;
  }
  if (!options.userInitiated && MoabomRuntime.getEffectiveOption('push') === false) {
    return;
  }
  if (!options.userInitiated && Notification.permission === 'default') {
    offerFcmPermissionPrimer();
    return;
  }
  if (Notification.permission !== 'granted') {
    return;
  }

  if (registerInFlight) {
    return registerInFlight;
  }

  registerInFlight = (async () => {
    const config = await fetchWebConfig();
    if (!config?.enabled || !config.firebase || !config.vapidKey) {
      return;
    }

    const firebase = await loadFirebaseCompat();
    if (!firebase?.initializeApp || !firebase.messaging) {
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    firebase.initializeApp({
      apiKey: config.firebase.apiKey,
      authDomain: config.firebase.authDomain || '',
      projectId: config.firebase.projectId,
      messagingSenderId: config.firebase.messagingSenderId,
      appId: config.firebase.appId,
    });

    const messaging = firebase.messaging();
    const token = await messaging.getToken({
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return;
    }

    await requestShellJson('/api/plugins/moabom-fcm/device-tokens', 'required', {
      method: 'POST',
      body: {
        token,
        platform: 'web',
        device_label: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 120) : null,
      },
    });
  })()
    .catch(() => {
      // FCM 미설정·권한 거부·CDN 실패는 셸을 막지 않음
    })
    .finally(() => {
      registerInFlight = null;
    });

  return registerInFlight;
}
