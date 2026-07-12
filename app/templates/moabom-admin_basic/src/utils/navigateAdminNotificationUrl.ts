/**
 * 관리자 알림 클릭 이동 — admin 표면 전용.
 * moabom-basic 셸/보드 런타임을 끌어오지 않는다.
 */
export function navigateAdminNotificationUrl(url: string | null | undefined): void {
  const trimmed = url?.trim();
  if (!trimmed) {
    return;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (typeof window !== 'undefined' && parsed.origin !== window.location.origin) {
        window.location.href = trimmed;
        return;
      }
      const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      window.location.href = path || '/';
      return;
    } catch {
      window.location.href = trimmed;
      return;
    }
  }

  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const G7Core = (window as { G7Core?: { dispatch?: (action: unknown) => void } }).G7Core;
  if (G7Core?.dispatch) {
    G7Core.dispatch({ handler: 'navigate', params: { path } });
    return;
  }

  window.location.href = path;
}
