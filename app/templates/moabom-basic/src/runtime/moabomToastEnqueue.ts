/**
 * G7 코어 `handleToast`는 `action`·`severity`·`duration: 0` 을 전달하지 않는다.
 * moabom 셸 시스템 토스트(PWA 업데이트 등)는 `_global.toasts` 에 직접 적재한다.
 */
export type MoabomToastActionButton = {
  label: string;
  onClick: () => void | Promise<void>;
  variant?: 'primary' | 'secondary';
};

export type MoabomToastEnqueuePayload = {
  id?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  message: string;
  severity?: 'system' | 'content';
  duration?: number;
  icon?: string;
  action?: MoabomToastActionButton;
  actions?: MoabomToastActionButton[];
};

let enqueueInstalled = false;

export function installMoabomToastEnqueue(): void {
  if (enqueueInstalled || typeof window === 'undefined') return;

  const G7Core = (window as { G7Core?: Record<string, unknown> }).G7Core;
  if (!G7Core || typeof G7Core.state?.update !== 'function') return;

  const toastApi = (G7Core.toast as Record<string, unknown> | undefined) ?? {};
  if (typeof toastApi.enqueue === 'function') {
    enqueueInstalled = true;
    return;
  }

  toastApi.enqueue = (payload: MoabomToastEnqueuePayload): string => {
    const toastId = payload.id ?? `toast_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    G7Core.state!.update((prev: Record<string, unknown>) => {
      const currentToasts = Array.isArray(prev.toasts) ? prev.toasts : [];

      return {
        toasts: [
          ...currentToasts,
          {
            id: toastId,
            type: payload.type ?? 'info',
            message: payload.message,
            ...(payload.severity ? { severity: payload.severity } : {}),
            ...(payload.icon ? { icon: payload.icon } : {}),
            ...(payload.duration !== undefined ? { duration: payload.duration } : {}),
            ...(payload.action ? { action: payload.action } : {}),
            ...(payload.actions?.length ? { actions: payload.actions } : {}),
          },
        ],
      };
    });
    return toastId;
  };

  G7Core.toast = toastApi;
  enqueueInstalled = true;
}

export function enqueueMoabomToast(payload: MoabomToastEnqueuePayload): string | null {
  installMoabomToastEnqueue();

  const G7Core = (window as { G7Core?: { toast?: { enqueue?: (p: MoabomToastEnqueuePayload) => string } } }).G7Core;
  if (typeof G7Core?.toast?.enqueue === 'function') {
    return G7Core.toast.enqueue(payload);
  }

  return null;
}

export function dismissMoabomToast(toastId: string): void {
  if (!toastId || typeof window === 'undefined') {
    return;
  }

  const G7Core = (window as { G7Core?: { state?: { update?: (fn: (prev: Record<string, unknown>) => Record<string, unknown>) => void } } }).G7Core;
  G7Core?.state?.update?.((prev) => {
    const currentToasts = Array.isArray(prev.toasts) ? prev.toasts : [];
    return {
      toasts: currentToasts.filter((toast: { id?: string }) => toast?.id !== toastId),
    };
  });
}

/** @internal 테스트 격리용 */
export function resetMoabomToastEnqueueForTest(): void {
  enqueueInstalled = false;
}
