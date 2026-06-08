/**
 * moabom-basic 템플릿 lang JSON 단일 로드 경로.
 *
 * G7 TranslationEngine 과 Moabom 오버레이가 동일 JSON 을 두 번 fetch 하지 않도록
 * (1) 전역 fetch dedupe, (2) 엔진 캐시 재사용(loadTranslations 반환값) 을 제공한다.
 */

export const MOABOM_TEMPLATE_LANG_ID = 'moabom-basic';

const LANG_PATH_RE = /^\/api\/templates\/moabom-basic\/lang\/([a-z]{2})\.json$/;

type TranslationEngineLike = {
  loadTranslations: (
    templateId: string,
    locale: string,
    apiBaseUrl?: string,
    bustCache?: boolean,
  ) => Promise<Record<string, unknown>>;
};

type WindowWithG7 = Window & {
  G7Core?: {
    extensionCacheVersion?: number;
    config?: { cacheVersion?: number };
    getTranslationEngine?: () => TranslationEngineLike | null;
  };
};

/** 확장 캐시 버전 — TranslationEngine 과 동일 출처 */
export function resolveMoabomExtensionCacheVersion(): number {
  const w = window as WindowWithG7;
  const cv = w.G7Core?.extensionCacheVersion ?? w.G7Core?.config?.cacheVersion ?? 0;
  return typeof cv === 'number' && cv > 0 ? cv : 0;
}

export function buildMoabomTemplateLangUrl(locale: string, cacheVersion?: number): string {
  const cv = cacheVersion ?? resolveMoabomExtensionCacheVersion();
  const qs = cv > 0 ? `?v=${cv}` : '';
  return `/api/templates/${MOABOM_TEMPLATE_LANG_ID}/lang/${locale}.json${qs}`;
}

const memoryByLocale = new Map<string, Record<string, unknown>>();
const inFlightByLocale = new Map<string, Promise<Record<string, unknown>>>();

export function clearMoabomTemplateLangJsonCache(): void {
  memoryByLocale.clear();
  inFlightByLocale.clear();
}

/** 엔진 미가용·캐시 미스 시에만 네트워크 fetch (로케일 단위 in-flight 공유) */
export async function fetchMoabomTemplateLangJson(
  locale: string,
  options?: { bustCache?: boolean },
): Promise<Record<string, unknown>> {
  const bustCache = options?.bustCache ?? false;
  if (!bustCache) {
    const mem = memoryByLocale.get(locale);
    if (mem) {
      return mem;
    }
  }

  let pending = inFlightByLocale.get(locale);
  if (!pending) {
    pending = (async () => {
      const url = buildMoabomTemplateLangUrl(locale);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load lang JSON (${locale}): ${response.status}`);
      }
      const data = (await response.json()) as Record<string, unknown>;
      memoryByLocale.set(locale, data);
      return data;
    })().finally(() => {
      if (inFlightByLocale.get(locale) === pending) {
        inFlightByLocale.delete(locale);
      }
    });
    inFlightByLocale.set(locale, pending);
  }

  return pending;
}

export async function waitForMoabomTranslationEngine(
  maxWaitMs = 8_000,
  pollMs = 50,
): Promise<TranslationEngineLike | null> {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const engine = (window as WindowWithG7).G7Core?.getTranslationEngine?.();
    if (engine) {
      return engine;
    }
    await new Promise<void>(resolve => {
      window.setTimeout(resolve, pollMs);
    });
  }
  return null;
}

/**
 * G7 TranslationEngine 에 이미 로드된 딕셔너리를 우선 사용하고,
 * 없을 때만 fetchMoabomTemplateLangJson 으로 폴백한다.
 */
export async function resolveMoabomTemplateLangDictionary(
  locale: string,
  options?: { bustCache?: boolean },
): Promise<Record<string, unknown>> {
  const bustCache = options?.bustCache ?? false;

  const engine = await waitForMoabomTranslationEngine(bustCache ? 0 : 8_000);
  if (engine) {
    try {
      const dict = await engine.loadTranslations(
        MOABOM_TEMPLATE_LANG_ID,
        locale,
        '/api',
        bustCache,
      );
      if (dict && typeof dict === 'object') {
        if (!bustCache) {
          memoryByLocale.set(locale, dict);
        }
        return dict;
      }
    } catch {
      /* 엔진 로드 실패 시 fetch 폴백 */
    }
  }

  return fetchMoabomTemplateLangJson(locale, { bustCache });
}

let dedupeInstalled = false;

/**
 * template-engine.min.js 의 loadTranslations fetch 와 오버레이 fetch 를
 * 로케일 단위로 병합한다. components.iife.js 가 template-engine 보다 뒤에 로드되므로
 * DOMContentLoaded 이전에 호출해야 TemplateApp.init 과 경합하지 않는다.
 */
export function installMoabomTemplateLangFetchDedupe(): void {
  if (dedupeInstalled || typeof window === 'undefined') {
    return;
  }
  dedupeInstalled = true;

  const nativeFetch = window.fetch.bind(window);
  const langInflight = new Map<string, Promise<Response>>();

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url: URL;
    try {
      const href =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      url = new URL(href, window.location.href);
    } catch {
      return nativeFetch(input, init);
    }

    const match = url.pathname.match(LANG_PATH_RE);
    if (!match) {
      return nativeFetch(input, init);
    }

    const locale = match[1];
    const existing = langInflight.get(locale);
    if (existing) {
      return existing.then(response => response.clone());
    }

    const normalized = buildMoabomTemplateLangUrl(locale);
    const promise = nativeFetch(normalized, init).finally(() => {
      if (langInflight.get(locale) === promise) {
        langInflight.delete(locale);
      }
    });
    langInflight.set(locale, promise);
    return promise;
  };
}

/** Vitest: fetch 패치 복원 */
export function resetMoabomTemplateLangFetchDedupeForTest(): void {
  dedupeInstalled = false;
}
