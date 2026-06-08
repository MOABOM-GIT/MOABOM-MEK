import type { MoabomSystemLanguage } from '../types/moabomSystem';
import { moabomOverlayLocales } from '../utils/moabomLocaleCatalog';
import {
  clearMoabomTemplateLangJsonCache,
  resolveMoabomTemplateLangDictionary,
} from './moabomTemplateLangJsonFetch';

let overlayFlat: Record<string, string> | null = null;
/** 활성 오버레이 로케일. 전역 `locale.change` 없이 moabomT만 덮어쓸 때 사용 */
let overlayLocaleActive: MoabomSystemLanguage | null = null;
const overlayLoadPromises = new Map<MoabomSystemLanguage, Promise<void>>();

/** `clearMoabomTranslationOverlay` 호출·로케일 전환 시 증가. 진행 중 fetch 가 끝나도 적용 생략. */
let overlayLoadGeneration = 0;

/**
 * `useMoabomT(language)` / 셸이 해석 중인 `preferences.language`.
 * 오버레이 JSON 로드가 끝나기 전에 이 값과 `overlayLocaleActive`가 어긋나면 이전 로케일 문자열이 타이틀·번역에 섞인다.
 */
let shellUiLocaleRequested: MoabomSystemLanguage | null = null;

export function setShellUiTranslationLocale(locale: MoabomSystemLanguage | null): void {
  shellUiLocaleRequested = locale;
}

/** Vitest 등: 힌트 초기화 */
export function clearShellUiTranslationLocaleHint(): void {
  shellUiLocaleRequested = null;
}

function isOverlayStaleVsShellLocale(): boolean {
  if (shellUiLocaleRequested === null || overlayLocaleActive === null) {
    return false;
  }
  return shellUiLocaleRequested !== overlayLocaleActive;
}

/**
 * `resolveAppStrings` 등: 요청 로케일과 동일한 오버레이가 로드·힌트와 일치할 때만 오버레이 카탈로그를 신뢰한다.
 */
export function isMoabomOverlaySyncedToLocale(locale: MoabomSystemLanguage): boolean {
  if (overlayFlat === null || overlayLocaleActive === null) {
    return false;
  }
  if (overlayLocaleActive !== locale) {
    return false;
  }
  return !isOverlayStaleVsShellLocale();
}

/** `moabomT`: 셸 힌트와 오버레이 로케일이 다르면 오버레이 조회를 건너뛴다. */
export function shouldMoabomTSkipOverlayLookup(): boolean {
  return isOverlayStaleVsShellLocale();
}

function flattenTranslations(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flattenTranslations(v as Record<string, unknown>, key));
    } else if (v !== undefined && v !== null) {
      out[key] = String(v);
    }
  }
  return out;
}

export function clearMoabomTranslationOverlay(): void {
  overlayFlat = null;
  overlayLocaleActive = null;
  overlayLoadPromises.clear();
  clearMoabomTemplateLangJsonCache();
  overlayLoadGeneration += 1;
}

export function interpolateMoabomTemplate(template: string, params?: Record<string, string | number>): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    params[name] !== undefined && params[name] !== null ? String(params[name]) : `{${name}}`,
  );
}

/**
 * 템플릿 언어 API JSON을 로드해 moabomT 오버레이로 사용합니다.
 * `ko|en|ja|zh` 모두 동일 엔드포인트(`/api/templates/moabom-basic/lang/{locale}.json`)에서 로드합니다.
 */
export async function loadMoabomTranslationOverlay(locale: MoabomSystemLanguage): Promise<void> {
  const overlayLocales = moabomOverlayLocales();
  if (!overlayLocales.includes(locale)) {
    clearMoabomTranslationOverlay();
    return;
  }

  if (overlayLocaleActive === locale && overlayFlat !== null) {
    return;
  }

  if (overlayLocaleActive !== null && overlayLocaleActive !== locale) {
    clearMoabomTranslationOverlay();
  }

  const pending = overlayLoadPromises.get(locale);
  if (pending) {
    await pending;
    return;
  }

  const loadPromise = (async () => {
    const loadToken = overlayLoadGeneration;
    const applyIfCurrent = () => {
      if (loadToken !== overlayLoadGeneration) {
        return false;
      }
      return true;
    };
    try {
      /**
       * G7 TranslationEngine 이 부트 시 이미 fetch 한 딕셔너리를 재사용한다.
       * loadTranslations 는 캐시 히트 시 네트워크를 쓰지 않으며, locale 전역 상태를 바꾸지 않는다.
       * 엔진 미준비·실패 시에만 resolveMoabomTemplateLangDictionary 가 fetch 한다.
       */
      const data = await resolveMoabomTemplateLangDictionary(locale);
      if (!applyIfCurrent()) {
        return;
      }
      overlayFlat = flattenTranslations(data);
      overlayLocaleActive = locale;
    } catch {
      if (!applyIfCurrent()) {
        return;
      }
      overlayFlat = {};
      overlayLocaleActive = locale;
    }
  })();

  overlayLoadPromises.set(locale, loadPromise);
  try {
    await loadPromise;
  } finally {
    if (overlayLoadPromises.get(locale) === loadPromise) {
      overlayLoadPromises.delete(locale);
    }
  }
}

export function lookupMoabomOverlay(key: string): string | undefined {
  if (!overlayFlat || !overlayLocaleActive) {
    return undefined;
  }
  const raw = overlayFlat[key];
  return raw !== undefined ? raw : undefined;
}

export function isMoabomOverlayLocaleActive(): boolean {
  return overlayLocaleActive !== null;
}
