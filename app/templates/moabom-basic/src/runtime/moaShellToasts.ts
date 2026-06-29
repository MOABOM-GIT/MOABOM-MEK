import { enqueueMoabomToast, dismissMoabomToast } from './moabomToastEnqueue';
import type { MoabomToastActionButton } from './moabomToastEnqueue';

export function showAppEditToast(type: 'success' | 'warning', message: string): void {
  const G7Core = (window as { G7Core?: { toast?: { success?: (msg: string, ms: number) => void; warning?: (msg: string, ms: number) => void }; dispatch?: (action: { handler: string; params: Record<string, unknown> }) => void } }).G7Core;
  if (type === 'success') {
    if (G7Core?.toast?.success) {
      G7Core.toast.success(message, 2500);
    } else {
      G7Core?.dispatch?.({ handler: 'toast', params: { type: 'success', message, duration: 2500 } });
    }
    return;
  }

  if (G7Core?.toast?.warning) {
    G7Core.toast.warning(message, 2500);
  } else {
    G7Core?.dispatch?.({ handler: 'toast', params: { type: 'warning', message, duration: 2500 } });
  }
}

export function pushWarningToast(message: string, duration = 3000): void {
  const G7Core = (window as { G7Core?: { toast?: { warning?: (msg: string, ms: number) => void }; dispatch?: (action: { handler: string; params: Record<string, unknown> }) => void } }).G7Core;
  if (G7Core?.toast?.warning) {
    G7Core.toast.warning(message, duration);
    return;
  }
  G7Core?.dispatch?.({ handler: 'toast', params: { type: 'warning', message, duration } });
}

/** 실시간 알림 토스트 — 사용자 `toast` 옵션(content)과 동일한 severity. */
export function pushNotificationToast(
  message: string,
  duration = 2800,
  action?: { label: string; onClick: () => void | Promise<void>; variant?: 'primary' | 'secondary' },
  actions?: MoabomToastActionButton[],
): void {
  const resolvedActions = actions?.length
    ? actions
    : (action ? [action] : undefined);

  if (
    enqueueMoabomToast({
      type: 'info',
      severity: 'content',
      duration,
      message,
      ...(resolvedActions?.length ? { actions: resolvedActions } : {}),
    }) !== null
  ) {
    return;
  }
  pushInfoToast(message, duration);
}

export function pushInfoToast(message: string, duration = 2800): void {
  const G7Core = (window as { G7Core?: { toast?: { info?: (msg: string, ms: number) => void; warning?: (msg: string, ms: number) => void }; dispatch?: (action: { handler: string; params: Record<string, unknown> }) => void } }).G7Core;
  if (G7Core?.toast?.info) {
    G7Core.toast.info(message, duration);
    return;
  }
  if (G7Core?.toast?.warning) {
    G7Core.toast.warning(message, duration);
    return;
  }
  G7Core?.dispatch?.({ handler: 'toast', params: { type: 'info', message, duration } });
}

export interface ConfirmToastOptions {
  message: string;
  /** 확인 버튼 라벨 */
  confirmLabel: string;
  /** 토스트 타입 (기본 warning) */
  type?: 'success' | 'error' | 'warning' | 'info';
  /** 확인 버튼 강조 스타일 (기본 primary) */
  confirmVariant?: 'primary' | 'secondary';
}

/**
 * `window.confirm` 의 토스트 대체 — 확인 버튼이 달린 시스템 토스트를 띄우고
 * 사용자의 선택을 `Promise<boolean>` 으로 반환한다.
 *
 * - `duration: 0` 으로 자동 닫힘을 끄고, 사용자가 버튼을 누를 때까지 유지된다.
 * - X(닫기) 버튼은 취소(`false`)와 동일하게 처리된다.
 * - 토스트 시스템을 사용할 수 없으면(`enqueue` 미설치) 네이티브 `window.confirm` 으로 폴백한다.
 */
export function confirmViaToast(options: ConfirmToastOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let toastId: string | null = null;

    const finish = (result: boolean): void => {
      if (settled) return;
      settled = true;
      if (toastId) {
        dismissMoabomToast(toastId);
      }
      resolve(result);
    };

    toastId = enqueueMoabomToast({
      type: options.type ?? 'warning',
      severity: 'system',
      duration: 0,
      message: options.message,
      onDismiss: () => finish(false),
      actions: [
        {
          label: options.confirmLabel,
          variant: options.confirmVariant ?? 'primary',
          onClick: () => finish(true),
        },
      ],
    });

    if (toastId === null) {
      finish(typeof window !== 'undefined' ? window.confirm(options.message) : false);
    }
  });
}
