import type { Workbox } from 'workbox-window';

export const MOABOM_PWA_UPDATE_EVENT = 'moabom-pwa-update-available';

type PwaWorkboxRef = Pick<Workbox, 'messageSkipWaiting'>;

let pendingWorkbox: PwaWorkboxRef | null = null;

/**
 * waiting SW 를 브릿지에 적재하고 커스텀 이벤트를 발행한다.
 * React Toast 마운트 전에도 이벤트를 놓치지 않도록 pending 을 유지한다.
 */
export function emitMoabomPwaUpdateAvailable(wb: PwaWorkboxRef): void {
  if (typeof window === 'undefined') return;

  pendingWorkbox = wb;
  window.dispatchEvent(
    new CustomEvent(MOABOM_PWA_UPDATE_EVENT, {
      detail: { wb },
    }),
  );
}

/** 아직 소비되지 않은 waiting Workbox 참조. */
export function peekPendingMoabomPwaUpdate(): PwaWorkboxRef | null {
  return pendingWorkbox;
}

/** @internal 테스트 격리용 */
export function resetMoabomPwaUpdateBridgeForTest(): void {
  pendingWorkbox = null;
}
