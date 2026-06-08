/**
 * Moabom UI 언어 ↔ G7 전역 로케일 동기화
 *
 * sirsoft-basic 은 `G7Core.dispatch({ handler: 'setLocale' })` → 엔진 builtin →
 * `TemplateApp.changeLocale()` (g7_locale + users.language + TranslationEngine 재로드) 를 사용합니다.
 *
 * Moabom 홈/마이페이지는 `destroyTemplate` 로 창 상태가 초기화되므로 full changeLocale 대신
 * 동일한 저장소·엔진·오버레이 축만 맞춥니다.
 */
import type { MoabomSystemLanguage } from '../types/moabomSystem';
import { isMoabomUiLanguage } from '../utils/moabomLocaleCatalog';
import {
  isMoabomOverlaySyncedToLocale,
  loadMoabomTranslationOverlay,
  setShellUiTranslationLocale,
} from './moabomTranslationOverlay';

export const MOABOM_TEMPLATE_ID = 'moabom-basic';

import { MOABOM_LOCALE_SYNCED_EVENT } from './moabomShellEvents';

export { MOABOM_LOCALE_SYNCED_EVENT };

let syncInFlight: Promise<void> | null = null;
let lastSyncedLocale: MoabomSystemLanguage | null = null;

/** `preferences.language` 변경 직후 — 다음 sync 가 G7·오버레이를 다시 맞추도록 */
export function invalidateMoabomLocaleSync(): void {
  lastSyncedLocale = null;
}

/** 마이페이지 등에서 UI 언어 저장 직후 — `syncMoabomLocaleWithG7` 재실행을 유도 */
export function markMoabomUiLanguageDirty(): void {
  invalidateMoabomLocaleSync();
}

function persistG7LocaleStorage(locale: string): void {
  try {
    localStorage.setItem('g7_locale', locale);
  } catch {
    /* ignore */
  }
}

/**
 * Moabom `preferences.language` 를 G7 축(g7_locale, users.language, TranslationEngine, 오버레이)에 반영합니다.
 */
export async function syncMoabomLocaleWithG7(locale: string): Promise<void> {
  if (!isMoabomUiLanguage(locale)) {
    return;
  }

  const uiLocale = locale as MoabomSystemLanguage;
  if (lastSyncedLocale === uiLocale && isMoabomOverlaySyncedToLocale(uiLocale)) {
    return;
  }

  if (syncInFlight) {
    await syncInFlight;
    if (lastSyncedLocale === uiLocale && isMoabomOverlaySyncedToLocale(uiLocale)) {
      return;
    }
  }

  syncInFlight = (async () => {
    setShellUiTranslationLocale(uiLocale);
    persistG7LocaleStorage(uiLocale);
    await loadMoabomTranslationOverlay(uiLocale);

    lastSyncedLocale = uiLocale;

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(MOABOM_LOCALE_SYNCED_EVENT, { detail: { locale: uiLocale } }),
      );
    }
  })();

  try {
    await syncInFlight;
  } finally {
    syncInFlight = null;
  }
}
