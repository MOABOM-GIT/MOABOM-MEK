export type SocialProvider = 'google' | 'naver' | 'kakao' | 'facebook' | 'apple';

export interface SocialProviderConfig {
  provider: SocialProvider;
  label: string;
}

export const SOCIAL_AUTH_MESSAGE_TYPE = 'moabom-social-auth';

export interface SocialAuthPopupMessage {
  type: typeof SOCIAL_AUTH_MESSAGE_TYPE;
  status: 'success' | 'error';
  provider?: string | null;
  code?: string | null;
  error?: string | null;
}

export const socialProviderConfigs: SocialProviderConfig[] = [
  { provider: 'google', label: 'Google' },
  { provider: 'kakao', label: 'Kakao' },
  { provider: 'naver', label: 'Naver' },
  { provider: 'facebook', label: 'Facebook' },
  { provider: 'apple', label: 'Apple' },
];

interface ProvidersResponse {
  success?: boolean;
  data?: {
    providers?: string[];
  };
}

type SocialAuthPopupHandler = (message: SocialAuthPopupMessage) => void;

const POPUP_WINDOW_NAME_PREFIX = 'moabom-social-auth-';
const popupHandlers = new Set<SocialAuthPopupHandler>();
let popupListenerInstalled = false;

let enabledProvidersCache: string[] | null = null;
let enabledProvidersPromise: Promise<string[]> | null = null;

/** 테스트 또는 동일 세션에서 provider 설정을 다시 불러와야 할 때 캐시를 비웁니다. */
export function resetSocialAuthProvidersCache(): void {
  enabledProvidersCache = null;
  enabledProvidersPromise = null;
}

/** popup postMessage 브리지 테스트/리셋용 */
export function resetSocialAuthPopupBridge(): void {
  popupHandlers.clear();
  popupListenerInstalled = false;
}

export function getSocialAuthRedirectUrl(provider: string, popup = false): string {
  const query = popup ? '?popup=1' : '';
  return `/api/modules/moabom-social-auth/${provider}/redirect${query}`;
}

function buildPopupFeatures(): string {
  const width = 520;
  const height = 720;
  const left = Math.max(0, Math.round((window.screen.width - width) / 2));
  const top = Math.max(0, Math.round((window.screen.height - height) / 2));

  // noopener/noreferrer 는 window.opener 를 null 로 만들어 popup-complete postMessage 가 실패한다.
  return [
    'popup=yes',
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    'resizable=yes',
    'scrollbars=yes',
  ].join(',');
}

function ensureSocialAuthPopupListener(): void {
  if (popupListenerInstalled || typeof window === 'undefined') {
    return;
  }

  popupListenerInstalled = true;
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== window.location.origin) {
      return;
    }

    const data = event.data as SocialAuthPopupMessage | undefined;
    if (!data || data.type !== SOCIAL_AUTH_MESSAGE_TYPE) {
      return;
    }

    popupHandlers.forEach((handler) => {
      try {
        handler(data);
      } catch {
        // handler 오류가 다른 구독자를 막지 않도록 격리
      }
    });
  });
}

/** SNS popup OAuth 완료 메시지를 구독합니다. */
export function subscribeSocialAuthPopupMessages(handler: SocialAuthPopupHandler): () => void {
  ensureSocialAuthPopupListener();
  popupHandlers.add(handler);

  return () => {
    popupHandlers.delete(handler);
  };
}

/**
 * SNS OAuth를 팝업으로 시작합니다.
 * 사용자 클릭 핸들러에서 동기 호출되어야 popup blocker 를 피할 수 있습니다.
 */
export function startSocialAuth(provider: string, usePopup = true): void {
  if (!usePopup) {
    window.location.href = getSocialAuthRedirectUrl(provider, false);
    return;
  }

  ensureSocialAuthPopupListener();

  const url = getSocialAuthRedirectUrl(provider, true);
  const popup = window.open(url, `${POPUP_WINDOW_NAME_PREFIX}${provider}`, buildPopupFeatures());

  if (!popup || popup.closed) {
    (window as any).G7Core?.toast?.error?.(
      '브라우저에서 팝업이 차단되었습니다. 사이트 팝업 허용 후 다시 시도해주세요.',
      5000,
    );
    return;
  }

  try {
    popup.focus();
  } catch {
    // 일부 브라우저에서 focus 가 거부될 수 있음
  }
}

export async function fetchEnabledSocialProviders(): Promise<string[]> {
  if (enabledProvidersCache) {
    return enabledProvidersCache;
  }

  if (enabledProvidersPromise) {
    return enabledProvidersPromise;
  }

  enabledProvidersPromise = loadEnabledSocialProviders();

  try {
    enabledProvidersCache = await enabledProvidersPromise;
    return enabledProvidersCache;
  } finally {
    enabledProvidersPromise = null;
  }
}

async function loadEnabledSocialProviders(): Promise<string[]> {
  try {
    const response = await fetch('/api/modules/moabom-social-auth/providers', {
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json() as ProvidersResponse;

    if (!response.ok || !payload.success) {
      return [];
    }

    return Array.isArray(payload.data?.providers) ? payload.data.providers : [];
  } catch {
    return [];
  }
}
