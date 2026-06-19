import { Workbox } from 'workbox-window';
import { emitMoabomPwaUpdateAvailable } from './moabomPwaUpdateBridge';

/**
 * PWA Service Worker 등록 옵션.
 */
export interface RegisterOptions {
  /** 기본값 `/`. 관리자 셸에서는 호출 자체를 하지 않는다. */
  scope?: string;
  /** SW 엔드포인트. 기본값 `/pwa/sw.js`. */
  swUrl?: string;
}

let registered = false;

/**
 * 테스트 격리용. 프로덕션 코드에서는 호출하지 않는다.
 *
 * @internal
 */
export function resetMoabomPwaServiceWorkerRegistrationForTest(): void {
  registered = false;
}

/**
 * waiting 이벤트 수신 시 사용자 승인 UX 로 전달한다.
 *
 * Silent 갱신 금지 요구사항 때문에 여기서는 `messageSkipWaiting()` 을 호출하지 않는다.
 */
export function handleWaiting(wb: Workbox): void {
  emitMoabomPwaUpdateAvailable(wb);
}

async function dispatchWaitingIfNeeded(wb: Workbox, scope: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration(scope);
    if (registration?.waiting) {
      handleWaiting(wb);
    }
  } catch {
    // 등록 조회 실패 시 waiting 이벤트에만 의존한다.
  }
}

/**
 * moabom-basic 사용자 셸의 Service Worker 를 1회 등록한다.
 */
export async function registerMoabomPwaServiceWorker(options: RegisterOptions = {}): Promise<void> {
  if (registered) return;
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;

  registered = true;

  const scope = options.scope ?? '/';
  const wb = new Workbox(options.swUrl ?? '/pwa/sw.js', {
    scope,
  });

  wb.addEventListener('waiting', () => handleWaiting(wb));

  try {
    await wb.register();
    await dispatchWaitingIfNeeded(wb, scope);
  } catch (error) {
    console.warn('[moabom-pwa] Service Worker registration failed.', error);
  }
}
