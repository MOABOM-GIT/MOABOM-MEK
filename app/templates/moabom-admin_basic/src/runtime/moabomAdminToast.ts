/**
 * 관리자 템플릿 공용 토스트 헬퍼.
 *
 * G7 코어 `handleToast` 는 `action`/`actions`(버튼) 를 전달하지 않으므로,
 * 버튼이 달린 토스트는 `_global.toasts` 에 직접 적재한다. (moabom-basic `moabomToastEnqueue` 와 동일 계약)
 *
 * 네이티브 `alert()`/`confirm()` 을 토스트로 대체하기 위한 단일 진입점이다.
 */

export type MoabomAdminToastActionButton = {
  label: string;
  onClick: () => void | Promise<void>;
  variant?: 'primary' | 'secondary';
};

export type MoabomAdminToastPayload = {
  id?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  icon?: string;
  action?: MoabomAdminToastActionButton;
  actions?: MoabomAdminToastActionButton[];
  onDismiss?: () => void;
};

type AdminToastApi = {
  enqueue?: (payload: MoabomAdminToastPayload) => string;
};

type G7CoreLike = {
  state?: {
    update?: (fn: (prev: Record<string, unknown>) => Record<string, unknown>) => void;
  };
  toast?: AdminToastApi & Record<string, unknown>;
  dispatch?: (action: { handler: string; params: Record<string, unknown> }) => void;
};

let enqueueInstalled = false;

export function installMoabomAdminToastEnqueue(): void {
  if (enqueueInstalled || typeof window === 'undefined') return;

  const G7Core = (window as { G7Core?: G7CoreLike }).G7Core;
  if (!G7Core || typeof G7Core.state?.update !== 'function') return;

  const toastApi: AdminToastApi & Record<string, unknown> = G7Core.toast ?? {};
  if (typeof toastApi.enqueue === 'function') {
    enqueueInstalled = true;
    return;
  }

  toastApi.enqueue = (payload: MoabomAdminToastPayload): string => {
    const toastId = payload.id ?? `toast_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    G7Core.state!.update!((prev) => {
      const currentToasts = Array.isArray(prev.toasts) ? prev.toasts : [];
      return {
        toasts: [
          ...currentToasts,
          {
            id: toastId,
            type: payload.type ?? 'info',
            message: payload.message,
            ...(payload.icon ? { icon: payload.icon } : {}),
            ...(payload.duration !== undefined ? { duration: payload.duration } : {}),
            ...(payload.action ? { action: payload.action } : {}),
            ...(payload.actions?.length ? { actions: payload.actions } : {}),
            ...(payload.onDismiss ? { onDismiss: payload.onDismiss } : {}),
          },
        ],
      };
    });
    return toastId;
  };

  G7Core.toast = toastApi;
  enqueueInstalled = true;
}

/** 버튼 포함 토스트를 적재한다. 실패 시 코어 `toast` 핸들러로 폴백하고 `null` 을 반환한다. */
export function enqueueMoabomAdminToast(payload: MoabomAdminToastPayload): string | null {
  installMoabomAdminToastEnqueue();

  const G7Core = (window as { G7Core?: G7CoreLike }).G7Core;
  if (typeof G7Core?.toast?.enqueue === 'function') {
    return G7Core.toast.enqueue(payload);
  }

  // enqueue 미설치(버튼 없는 환경) → 코어 토스트 핸들러로 메시지만 표시
  G7Core?.dispatch?.({
    handler: 'toast',
    params: {
      type: payload.type ?? 'info',
      message: payload.message,
      ...(payload.duration !== undefined ? { duration: payload.duration } : {}),
      ...(payload.icon ? { icon: payload.icon } : {}),
    },
  });
  return null;
}

export function dismissMoabomAdminToast(toastId: string): void {
  if (!toastId || typeof window === 'undefined') return;

  const G7Core = (window as { G7Core?: G7CoreLike }).G7Core;
  G7Core?.state?.update?.((prev) => {
    const currentToasts = Array.isArray(prev.toasts) ? prev.toasts : [];
    return {
      toasts: currentToasts.filter((toast) => (toast as { id?: string })?.id !== toastId),
    };
  });
}

/** `alert()` 대체 — 단일 메시지 토스트. */
export function pushMoabomAdminToast(
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info',
  duration = 4000,
): void {
  enqueueMoabomAdminToast({ type, message, duration });
}

export interface AdminConfirmToastOptions {
  message: string;
  confirmLabel: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  confirmVariant?: 'primary' | 'secondary';
}

/**
 * `window.confirm` 의 토스트 대체 — 확인 버튼이 달린 토스트를 띄우고
 * 사용자 선택을 `Promise<boolean>` 으로 반환한다. (`duration: 0` 으로 자동 닫힘 비활성)
 * X(닫기) 버튼은 취소(`false`)와 동일하게 처리된다.
 * 토스트 enqueue 를 사용할 수 없으면 네이티브 `window.confirm` 으로 폴백한다.
 */
export function confirmViaMoabomAdminToast(options: AdminConfirmToastOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let toastId: string | null = null;

    const finish = (result: boolean): void => {
      if (settled) return;
      settled = true;
      if (toastId) {
        dismissMoabomAdminToast(toastId);
      }
      resolve(result);
    };

    toastId = enqueueMoabomAdminToast({
      type: options.type ?? 'warning',
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

/** @internal 테스트 격리용 */
export function resetMoabomAdminToastEnqueueForTest(): void {
  enqueueInstalled = false;
}
