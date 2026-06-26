import type { ToastType } from '../components/composite/Toast';
import { dismissMoabomToast, enqueueMoabomToast } from './moabomToastEnqueue';

export type MoabomToastActionButton = {
  label: string;
  onClick: () => void | Promise<void>;
  variant?: 'primary' | 'secondary';
};

export type PushActionToastOptions = {
  message: string;
  type?: ToastType;
  severity?: 'system' | 'content';
  duration?: number;
  actions: MoabomToastActionButton[];
};

export type PushConfirmToastOptions = {
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  type?: ToastType;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
};

export function pushActionToast(options: PushActionToastOptions): string | null {
  const { message, type = 'info', severity = 'system', duration = 0, actions } = options;
  if (actions.length === 0) {
    return null;
  }

  return enqueueMoabomToast({
    type,
    severity,
    duration,
    message,
    actions,
  });
}

export function pushConfirmToast(options: PushConfirmToastOptions): string | null {
  const {
    message,
    confirmLabel,
    cancelLabel,
    type = 'warning',
    onConfirm,
    onCancel,
  } = options;

  const toastId = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const enqueuedId = enqueueMoabomToast({
    id: toastId,
    message,
    type,
    severity: 'system',
    duration: 0,
    actions: [
      ...(cancelLabel
        ? [{
          label: cancelLabel,
          variant: 'secondary' as const,
          onClick: () => {
            onCancel?.();
            dismissMoabomToast(toastId);
          },
        }]
        : []),
      {
        label: confirmLabel,
        variant: 'primary' as const,
        onClick: async () => {
          try {
            await onConfirm();
          } finally {
            dismissMoabomToast(toastId);
          }
        },
      },
    ],
  });

  return enqueuedId;
}
