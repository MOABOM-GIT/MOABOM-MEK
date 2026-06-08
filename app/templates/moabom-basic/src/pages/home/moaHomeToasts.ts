export function showAppEditToast(type: 'success' | 'warning', message: string): void {
  const G7Core = (window as any).G7Core;
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
  const G7Core = (window as any).G7Core;
  if (G7Core?.toast?.warning) {
    G7Core.toast.warning(message, duration);
    return;
  }
  G7Core?.dispatch?.({ handler: 'toast', params: { type: 'warning', message, duration } });
}

export function pushInfoToast(message: string, duration = 2800): void {
  const G7Core = (window as any).G7Core;
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
