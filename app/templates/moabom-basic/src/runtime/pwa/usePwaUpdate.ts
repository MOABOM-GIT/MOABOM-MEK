import { useCallback, useEffect, useRef, useState } from 'react';
import type { Workbox } from 'workbox-window';
import { moabomT } from '../../i18n/moabomT';
import { loadMoabomTranslationOverlay } from '../../i18n/moabomTranslationOverlay';
import { enqueueMoabomToast } from '../moabomToastEnqueue';
import { loadMoabomSystemState } from '../../utils/moabomSystemStore';
import {
  MOABOM_PWA_UPDATE_EVENT,
  peekPendingMoabomPwaUpdate,
} from './moabomPwaUpdateBridge';

export interface UsePwaUpdateResult {
  /** waiting 토스트가 현재 사용자에게 노출 중인지. */
  updateAvailable: boolean;
  /** CTA 클릭 후 reload 대기 중 — 공통 로딩 오버레이 표시용. */
  isApplyingUpdate: boolean;
  /** 공통 로딩(AppLoadingSpinner) 라벨. */
  applyingLabel: string;
  /** CTA 클릭 시 호출. messageSkipWaiting → controllerchange → reload. */
  applyUpdate: () => Promise<void>;
}

interface PwaUpdateEventDetail {
  wb?: Pick<Workbox, 'messageSkipWaiting'>;
}

type PwaUpdateEvent = CustomEvent<PwaUpdateEventDetail>;

const UPDATE_MESSAGE_KEY = 'moa_shell.pwa.update.message';
const UPDATE_CTA_KEY = 'moa_shell.pwa.update.cta';
const UPDATE_LOADING_KEY = 'moa_shell.pwa.update.loading';
const FALLBACK_UPDATE_MESSAGE = '플랫폼이 업데이트 되었습니다.';
const FALLBACK_UPDATE_CTA = '다시 불러오기';
const FALLBACK_UPDATE_LOADING = '다시 불러오는 중…';
const ENQUEUE_RETRY_DELAYS_MS = [0, 100, 300, 800, 1500];
const RELOAD_TIMEOUT_MS = 12_000;

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

  return enqueueMoabomToast({
    type: 'info',
    severity: 'system',
    duration: 0,
    message: translate(UPDATE_MESSAGE_KEY, FALLBACK_UPDATE_MESSAGE),
    action: {
      label: translate(UPDATE_CTA_KEY, FALLBACK_UPDATE_CTA),
      variant: 'primary',
      onClick: applyUpdate,
    },
  }) !== null;
}

async function enqueueUpdateToastWithRetry(applyUpdate: () => Promise<void>): Promise<boolean> {
  for (const delayMs of ENQUEUE_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, delayMs);
      });
    }

    if (await enqueueUpdateToast(applyUpdate)) {
      return true;
    }
  }

  return false;
}

/**
 * PWA 업데이트 대기 상태를 시스템 토스트 1개로 노출한다.
 */
export function useMoabomPwaUpdate(): UsePwaUpdateResult {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const toastShownRef = useRef(false);
  const applyingRef = useRef(false);
  const reloadedRef = useRef(false);
  const waitingWorkboxRef = useRef<PwaUpdateEventDetail['wb'] | null>(null);
  const applyingLabel = translate(UPDATE_LOADING_KEY, FALLBACK_UPDATE_LOADING);

  const reloadOnce = useCallback((): void => {
    if (reloadedRef.current) {
      return;
    }

    reloadedRef.current = true;
    window.location.reload();
  }, []);

  const applyUpdate = useCallback(async (): Promise<void> => {
    if (applyingRef.current) return;
    applyingRef.current = true;
    setIsApplyingUpdate(true);

    try {
      const wb = waitingWorkboxRef.current;
      wb?.messageSkipWaiting?.();

      if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
        reloadOnce();
        return;
      }

      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = (): void => {
          if (settled) return;
          settled = true;
          resolve();
        };

        const onControllerChange = (): void => {
          navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
          reloadOnce();
          finish();
        };

        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

        window.setTimeout(() => {
          navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
          reloadOnce();
          finish();
        }, RELOAD_TIMEOUT_MS);
      });
    } catch {
      reloadOnce();
    }
  }, [reloadOnce]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const presentUpdateToast = async (wb: PwaUpdateEventDetail['wb'] | null | undefined) => {
      if (toastShownRef.current) return;

      waitingWorkboxRef.current = wb ?? peekPendingMoabomPwaUpdate();
      if (!waitingWorkboxRef.current) return;

      const shown = await enqueueUpdateToastWithRetry(applyUpdate);
      if (!shown) return;

      toastShownRef.current = true;
      setUpdateAvailable(true);
    };

    const handler = (event: Event) => {
      const customEvent = event as PwaUpdateEvent;
      void presentUpdateToast(customEvent.detail?.wb ?? null);
    };

    window.addEventListener(MOABOM_PWA_UPDATE_EVENT, handler);

    const pending = peekPendingMoabomPwaUpdate();
    if (pending) {
      void presentUpdateToast(pending);
    }

    return () => {
      window.removeEventListener(MOABOM_PWA_UPDATE_EVENT, handler);
    };
  }, [applyUpdate]);

  return {
    updateAvailable,
    isApplyingUpdate,
    applyingLabel,
    applyUpdate,
  };
}
