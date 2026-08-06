/**
 * Moabom 홈 셸 부트 파이프라인 — DOMContentLoaded·critical·secondary·tertiary·PWA 순서 SSOT.
 *
 * G7 `TemplateApp.init`(DOMContentLoaded)와 병행한다.
 * React 패널·훅·prefetch·SW는 `whenMoabomBootPhaseAtLeast` / `deferShell*Work` 로 이 단계에 정렬한다.
 *
 * 단계 요약:
 *   sync → document-ready → shell-critical → auth-ready → catalog-critical
 *   → handlers-ready (병렬) → secondary → tertiary-idle → pwa-idle → complete
 */

import { MOABOM_BOOT_PHASE_CHANGED_EVENT } from '../i18n/moabomShellEvents';
import { handlerMap } from '../handlers';
import { ensureMoabomShellBootLoaded } from './moabomShellBoot';
import { ensureMoabomShellAuthPreloaded } from './moabomShellAuthPreload';
import { awaitMoabomGeneratedAppLibraryPrefetch, prefetchMoabomGeneratedAppLibrary } from './moabomGeneratedAppLibraryLoad';
import { prefetchMoabomUserShellState } from './moabomUserShellState';

const BOOT_PERF_PREFIX = 'moabom:boot:';

/**
 * 인증 확정이 느려도(콜드 `/api/auth/user`, 최대 8s) 앱 카탈로그·secondary 진행을
 * 무한정 막지 않기 위한 상한. 사용자 상태 정확성은 `useMoabomShellAuth` 가
 * auth preload 프라미스를 직접 await 해 보장한다.
 */
const AUTH_GATE_BUDGET_MS = 2_000;

const logger = (typeof window !== 'undefined'
  ? (window as { G7Core?: { createLogger?: (n: string) => { log: (...a: unknown[]) => void; warn: (...a: unknown[]) => void } } }).G7Core?.createLogger?.('Template:moabom-boot')
  : undefined)
  ?? {
    log: (...args: unknown[]) => console.log('[Template:moabom-boot]', ...args),
    warn: (...args: unknown[]) => console.warn('[Template:moabom-boot]', ...args),
  };

/** 부트 단계 — 인덱스가 클수록 후순위 */
export type MoabomBootPhase =
  | 'sync'
  | 'document-ready'
  | 'shell-critical'
  | 'auth-ready'
  | 'catalog-critical'
  | 'handlers-ready'
  | 'secondary'
  | 'tertiary-idle'
  | 'pwa-idle'
  | 'complete';

const PHASE_ORDER: readonly MoabomBootPhase[] = [
  'sync',
  'document-ready',
  'shell-critical',
  'auth-ready',
  'catalog-critical',
  'handlers-ready',
  'secondary',
  'tertiary-idle',
  'pwa-idle',
  'complete',
] as const;

const phaseRank = new Map<MoabomBootPhase, number>(
  PHASE_ORDER.map((phase, index) => [phase, index]),
);

let currentPhase: MoabomBootPhase = 'sync';
let pipelineStarted = false;
const phaseWaiters = new Map<MoabomBootPhase, Set<() => void>>();

function markBootPerformance(phase: MoabomBootPhase): void {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') {
    return;
  }
  try {
    performance.mark(`${BOOT_PERF_PREFIX}${phase}`);
  } catch {
    // ignore
  }
}

function notifyPhaseWaiters(target: MoabomBootPhase): void {
  const targetRank = phaseRank.get(target) ?? 0;
  for (const [phase, waiters] of phaseWaiters.entries()) {
    if ((phaseRank.get(phase) ?? 0) > targetRank) {
      continue;
    }
    for (const resolve of waiters) {
      resolve();
    }
    phaseWaiters.delete(phase);
  }
}

export function getMoabomBootPhase(): MoabomBootPhase {
  return currentPhase;
}

export function isMoabomBootPhaseAtLeast(phase: MoabomBootPhase): boolean {
  return (phaseRank.get(currentPhase) ?? 0) >= (phaseRank.get(phase) ?? 0);
}

export function advanceMoabomBootPhase(phase: MoabomBootPhase): void {
  const nextRank = phaseRank.get(phase) ?? 0;
  const currentRank = phaseRank.get(currentPhase) ?? 0;
  if (nextRank <= currentRank) {
    return;
  }

  currentPhase = phase;
  markBootPerformance(phase);

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(MOABOM_BOOT_PHASE_CHANGED_EVENT, { detail: { phase } }));
  }
  notifyPhaseWaiters(phase);
  logger.log('phase →', phase);
}

export function whenMoabomBootPhaseAtLeast(
  phase: MoabomBootPhase,
  task: () => void,
): () => void {
  if (isMoabomBootPhaseAtLeast(phase)) {
    task();
    return () => {};
  }

  let cancelled = false;
  const run = () => {
    if (!cancelled) {
      task();
    }
  };

  const waiters = phaseWaiters.get(phase) ?? new Set();
  waiters.add(run);
  phaseWaiters.set(phase, waiters);

  return () => {
    cancelled = true;
    waiters.delete(run);
  };
}

export function awaitMoabomBootPhaseAtLeast(phase: MoabomBootPhase): Promise<void> {
  if (isMoabomBootPhaseAtLeast(phase)) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    whenMoabomBootPhaseAtLeast(phase, resolve);
  });
}

function whenDocumentReady(task: () => void): void {
  if (typeof document === 'undefined') {
    task();
    return;
  }

  if (document.readyState !== 'loading') {
    task();
    return;
  }

  document.addEventListener('DOMContentLoaded', task, { once: true });
}

function whenWindowLoad(task: () => void): void {
  if (typeof window === 'undefined') {
    task();
    return;
  }

  if (document.readyState === 'complete') {
    task();
    return;
  }

  window.addEventListener('load', task, { once: true });
}

function scheduleIdle(task: () => void, timeoutMs: number): void {
  if (typeof window === 'undefined') {
    task();
    return;
  }

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => task(), { timeout: timeoutMs });
  } else {
    window.setTimeout(task, 0);
  }
}

function registerTemplateHandlers(): void {
  if (typeof window === 'undefined') {
    return;
  }

  let retryCount = 0;
  const maxRetries = 50;
  const startedAt = typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

  const registerHandlers = () => {
    const actionDispatcher = (window as {
      G7Core?: { getActionDispatcher?: () => { registerHandler: (n: string, h: unknown) => void } };
    }).G7Core?.getActionDispatcher?.();

    if (actionDispatcher) {
      Object.entries(handlerMap).forEach(([name, handler]) => {
        actionDispatcher.registerHandler(name, handler);
      });
      logger.log(`${Object.keys(handlerMap).length} handler(s) registered`);
      advanceMoabomBootPhase('handlers-ready');
      return;
    }

    retryCount += 1;
    if (retryCount > maxRetries) {
      logger.warn('ActionDispatcher not available — handlers-ready skipped');
      advanceMoabomBootPhase('handlers-ready');
      return;
    }

    // 초기 ~500ms 는 rAF 로 빠르게 재시도(엔진 부트 직후 지연 축소), 이후 50ms.
    const elapsed = (typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now()) - startedAt;
    if (elapsed < 500 && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(registerHandlers);
      return;
    }
    window.setTimeout(registerHandlers, 50);
  };

  registerHandlers();
}

function runPwaIdlePhase(): void {
  const installManifestLink = () => {
    import('./pwa/installManifestLink')
      .then((module) => {
        module.installMoabomPwaManifestLink();
        module.installMoabomPwaIconLinks();
      })
      .catch((error) => {
        logger.warn('PWA manifest link module failed to load.', error);
      });
  };

  const registerServiceWorker = () => {
    if (!navigator.serviceWorker) {
      advanceMoabomBootPhase('complete');
      return;
    }

    import('./pwa/registerServiceWorker')
      .then((module) => module.registerMoabomPwaServiceWorker())
      .catch((error) => {
        logger.warn('PWA Service Worker registration module failed to load.', error);
      })
      .finally(() => {
        advanceMoabomBootPhase('complete');
      });
  };

  advanceMoabomBootPhase('pwa-idle');
  installManifestLink();
  registerServiceWorker();
}

/**
 * `index.ts` `initTemplate()` 에서 1회 호출.
 * sync 패치(install* · prefetch*) 직후 DOMContentLoaded 체인을 시작한다.
 */
export function startMoabomShellBootPipeline(): void {
  if (pipelineStarted || typeof window === 'undefined') {
    return;
  }
  pipelineStarted = true;
  markBootPerformance('sync');

  whenDocumentReady(() => {
    advanceMoabomBootPhase('document-ready');
    registerTemplateHandlers();

    void (async () => {
      // shell-boot + auth preload 병렬 — 직렬 waterfall 제거
      const bootPromise = ensureMoabomShellBootLoaded();
      const authPromise = ensureMoabomShellAuthPreloaded();
      void prefetchMoabomUserShellState();
      await bootPromise;
      advanceMoabomBootPhase('shell-critical');

      // auth 확정 시 auth-ready 표식 (게스트·캐시된 경우 즉시 resolve).
      void Promise.resolve(authPromise).then(() => advanceMoabomBootPhase('auth-ready'));

      // 인증이 느려도 앱 카탈로그·secondary 를 최대 AUTH_GATE_BUDGET_MS 만 대기하고 진행한다.
      await Promise.race([
        Promise.resolve(authPromise),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, AUTH_GATE_BUDGET_MS);
        }),
      ]);

      // catalog 단계만 통과 — library 는 secondary 시작 후 백그라운드 (unread/WS 와 RTT 경쟁 완화)
      advanceMoabomBootPhase('catalog-critical');
      advanceMoabomBootPhase('secondary');

      // library prefetch 는 memberKey 확정(auth 완료) 이후로 유지 — sync prefetch·catalog invalidate 경합 방지.
      void Promise.resolve(authPromise).finally(() => {
        prefetchMoabomGeneratedAppLibrary();
        void awaitMoabomGeneratedAppLibraryPrefetch().catch((error) => {
          logger.warn('generated-app-library prefetch failed (non-blocking).', error);
        });
      });

      // tertiary: 친구·알림·앱·공지 등 사용자 가시 데이터.
      // 과거 timeout 2000ms 는 first-paint 양보용이었으나 인터랙션 전체를 늦춰 제거.
      // idle 콜백만으로 한 프레임 양보하고 즉시 진행한다.
      scheduleIdle(() => {
        advanceMoabomBootPhase('tertiary-idle');
        whenWindowLoad(() => {
          scheduleIdle(runPwaIdlePhase, 3000);
        });
      }, 0);
    })();
  });
}

/** Vitest 격리 */
export function resetMoabomShellBootPipelineForTest(): void {
  currentPhase = 'sync';
  pipelineStarted = false;
  phaseWaiters.clear();
}
