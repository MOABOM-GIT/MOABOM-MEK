/**
 * PWA 「다시 불러오기」 직후 확장 상태(routes/layouts/i18n)를 관리자 `reloadExtensions` 수준으로 재동기화.
 */

import { ensureMoabomShellBootLoaded, invalidateMoabomShellBootCache } from '../moabomShellBoot';

export const MOABOM_PWA_EXTENSION_RESYNC_KEY = 'moabom:pwa-extension-resync';
export const G7_CACHE_VERSION_STORAGE_KEY = 'g7_cache_version';

const MAX_TEMPLATE_APP_WAIT_MS = 30_000;
const POLL_INTERVAL_MS = 50;

type TemplateAppResyncTarget = {
  reloadExtensionState?: () => Promise<void>;
  getRouter?: () => { navigate?: (path: string) => void } | null;
};

let consumeInstalled = false;

export function markMoabomPwaExtensionResync(): void {
  try {
    sessionStorage.setItem(MOABOM_PWA_EXTENSION_RESYNC_KEY, '1');
  } catch {
    // sessionStorage 불가(private mode 등)여도 reload 자체는 진행한다.
  }

  try {
    localStorage.removeItem(G7_CACHE_VERSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function isMoabomPwaExtensionResyncPending(): boolean {
  try {
    return sessionStorage.getItem(MOABOM_PWA_EXTENSION_RESYNC_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearMoabomPwaExtensionResyncMark(): void {
  try {
    sessionStorage.removeItem(MOABOM_PWA_EXTENSION_RESYNC_KEY);
  } catch {
    // ignore
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function waitForTemplateAppResyncTarget(): Promise<TemplateAppResyncTarget | null> {
  const started = Date.now();

  while (Date.now() - started < MAX_TEMPLATE_APP_WAIT_MS) {
    const app = (window as { __templateApp?: TemplateAppResyncTarget }).__templateApp;
    const router = app?.getRouter?.();

    if (app && typeof app.reloadExtensionState === 'function' && typeof router?.navigate === 'function') {
      return app;
    }

    await delay(POLL_INTERVAL_MS);
  }

  return null;
}

async function waitForInitialNavigationSettled(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
  await delay(0);
}

/**
 * PWA reload 직후 플래그가 있으면 확장 JSON·번역·layout 캐시를 재동기화하고 현재 경로를 다시 렌더한다.
 */
export async function runMoabomPwaExtensionResyncIfMarked(): Promise<boolean> {
  if (!isMoabomPwaExtensionResyncPending()) {
    return false;
  }

  clearMoabomPwaExtensionResyncMark();

  const app = await waitForTemplateAppResyncTarget();
  if (!app?.reloadExtensionState) {
    return false;
  }

  await waitForInitialNavigationSettled();

  invalidateMoabomShellBootCache();
  try {
    await ensureMoabomShellBootLoaded();
  } catch {
    // shell-boot 실패 시에도 routes/layout 재동기화는 계속한다.
  }

  try {
    await app.reloadExtensionState();
  } catch {
    // TemplateApp.reloadExtensionState 는 단계별 try/catch — 전체 throw 는 드묾.
  }

  try {
    const path = `${window.location.pathname}${window.location.search}`;
    app.getRouter?.()?.navigate?.(path);
  } catch {
    // ignore
  }

  return true;
}

/** `index.ts` 부트 초기에 1회 설치 — PWA resync 플래그가 있을 때만 비동기 소비한다. */
export function installMoabomPwaExtensionResyncConsume(): void {
  if (consumeInstalled || typeof window === 'undefined') {
    return;
  }

  consumeInstalled = true;

  if (!isMoabomPwaExtensionResyncPending()) {
    return;
  }

  void runMoabomPwaExtensionResyncIfMarked();
}

/** Vitest 격리 */
export function resetMoabomPwaExtensionResyncForTest(): void {
  consumeInstalled = false;
  clearMoabomPwaExtensionResyncMark();
}
