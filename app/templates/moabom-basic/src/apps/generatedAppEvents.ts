import type { StoredGeneratedAppSummary } from '../api/moabomAppsApi';

export const MOABOM_GENERATED_APP_SAVED_EVENT = 'moabom:generated-app-saved';

export function notifyGeneratedAppSaved(app: StoredGeneratedAppSummary): void {
  window.dispatchEvent(new CustomEvent<StoredGeneratedAppSummary>(
    MOABOM_GENERATED_APP_SAVED_EVENT,
    { detail: app },
  ));
}

export function subscribeGeneratedAppSaved(
  handler: (app: StoredGeneratedAppSummary) => void,
): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<StoredGeneratedAppSummary>).detail;
    if (detail?.id) {
      handler(detail);
    }
  };

  window.addEventListener(MOABOM_GENERATED_APP_SAVED_EVENT, listener);

  return () => window.removeEventListener(MOABOM_GENERATED_APP_SAVED_EVENT, listener);
}
