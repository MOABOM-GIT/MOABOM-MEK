import { useCallback, useEffect, useRef, useState } from 'react';
import type { Workbox } from 'workbox-window';
import { moabomT } from '../../i18n/moabomT';
import { loadMoabomTranslationOverlay } from '../../i18n/moabomTranslationOverlay';
import { loadMoabomSystemState } from '../../utils/moabomSystemStore';

export interface UsePwaUpdateResult {
  /** waiting 토스트가 현재 사용자에게 노출 중인지. */
  updateAvailable: boolean;
  /** CTA 클릭 시 호출. messageSkipWaiting → controllerchange → reload. */
  applyUpdate: () => Promise<void>;
}

interface PwaUpdateEventDetail {
  wb?: Pick<Workbox, 'messageSkipWaiting'>;
}

type PwaUpdateEvent = CustomEvent<PwaUpdateEventDetail>;

const UPDATE_EVENT = 'moabom-pwa-update-available';
const UPDATE_MESSAGE_KEY = 'moa_shell.pwa.update.message';
const UPDATE_CTA_KEY = 'moa_shell.pwa.update.cta';
const FALLBACK_UPDATE_MESSAGE = '플랫폼이 업데이트 되었습니다.';
const FALLBACK_UPDATE_CTA = '다시 불러오기';

async function ensurePwaTranslationsLoaded(): Promise<void> {
  try {
    const language = loadMoabomSystemState().preferences.language;
    await loadMoabomTranslationOverlay(language);
  } catch {
    // 번역 로딩 실패 시에도 PWA 업데이트 안내는 기본 문구로 노출한다.
  }
}

function translate(key: string, fallback: string): string {
  const translated = moabomT(key);
  if (typeof translated === 'string' && translated !== '' && translated !== key) {
    return translated;
  }
  return fallback;
}

async function enqueueUpdateToast(applyUpdate: () => Promise<void>): Promise<boolean> {
  await ensurePwaTranslationsLoaded();

  const G7Core = (window as any).G7Core;
  const payload = {
    type: 'info',
    severity: 'system',
    duration: 0,
    message: translate(UPDATE_MESSAGE_KEY, FALLBACK_UPDATE_MESSAGE),
    action: {
      label: translate(UPDATE_CTA_KEY, FALLBACK_UPDATE_CTA),
      onClick: applyUpdate,
    },
  };

  if (typeof G7Core?.toast?.enqueue === 'function') {
    G7Core.toast.enqueue(payload);
    return true;
  }

  if (typeof G7Core?.dispatch === 'function') {
    G7Core.dispatch({ handler: 'toast', params: payload });
    return true;
  }

  return false;
}

/**
 * PWA 업데이트 대기 상태를 시스템 토스트 1개로 노출한다.
 */
export function useMoabomPwaUpdate(): UsePwaUpdateResult {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const toastShownRef = useRef(false);
  const applyingRef = useRef(false);
  const reloadedRef = useRef(false);
  const waitingWorkboxRef = useRef<PwaUpdateEventDetail['wb'] | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyUpdate = useCallback(async (): Promise<void> => {
    if (applyingRef.current) return;
    applyingRef.current = true;

    const wb = waitingWorkboxRef.current;
    wb?.messageSkipWaiting?.();

    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;

    await new Promise<void>((resolve) => {
      const onControllerChange = () => {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        if (!reloadedRef.current) {
          reloadedRef.current = true;
          window.location.reload();
        }
        resolve();
      };

      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const clearRetryTimer = () => {
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const showToast = async () => {
      if (await enqueueUpdateToast(applyUpdate)) return;

      clearRetryTimer();
      retryTimerRef.current = setTimeout(() => {
        void enqueueUpdateToast(applyUpdate);
        retryTimerRef.current = null;
      }, 100);
    };

    const handler = (event: Event) => {
      if (toastShownRef.current) return;

      const customEvent = event as PwaUpdateEvent;
      waitingWorkboxRef.current = customEvent.detail?.wb ?? null;
      toastShownRef.current = true;
      setUpdateAvailable(true);
      void showToast();
    };

    window.addEventListener(UPDATE_EVENT, handler);

    return () => {
      clearRetryTimer();
      window.removeEventListener(UPDATE_EVENT, handler);
    };
  }, [applyUpdate]);

  return {
    updateAvailable,
    applyUpdate,
  };
}
