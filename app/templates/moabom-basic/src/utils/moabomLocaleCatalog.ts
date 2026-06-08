import type { MoabomSystemLanguage } from '../types/moabomSystem';

export interface MoabomLocaleCatalog {
  supported_locales: string[];
  locale_names: Record<string, string>;
  ui_locales: string[];
  ui_locale_names: Record<string, string>;
  /** UI 로케일 → G7 `users.language` / API 축 (서버 SSoT) */
  core_sync_locales?: Record<string, string>;
}

/** 마이페이지·셸 UI 언어 표시 순서 (서버 catalog 수신 전 비상용) */
export const MOABOM_UI_LOCALE_ORDER = ['ko', 'en', 'ja', 'zh'] as const;

function orderUiLocales(locales: string[]): string[] {
  const set = new Set(locales);
  const ordered: string[] = [];
  for (const code of MOABOM_UI_LOCALE_ORDER) {
    if (set.has(code)) {
      ordered.push(code);
      set.delete(code);
    }
  }
  for (const extra of set) {
    ordered.push(extra);
  }
  return ordered;
}

const FALLBACK: MoabomLocaleCatalog = {
  supported_locales: ['ko', 'en'],
  locale_names: { ko: '한국어', en: 'English' },
  ui_locales: [...MOABOM_UI_LOCALE_ORDER],
  ui_locale_names: {
    ko: '한국어',
    en: 'English',
    ja: '日本語',
    zh: '中文',
  },
  core_sync_locales: {
    ko: 'ko',
    en: 'en',
    ja: 'en',
    zh: 'en',
  },
};

let cached: MoabomLocaleCatalog | null = null;

export function setMoabomLocaleCatalog(catalog: MoabomLocaleCatalog | null | undefined): void {
  if (!catalog || !Array.isArray(catalog.ui_locales) || catalog.ui_locales.length === 0) {
    cached = null;
    return;
  }
  cached = {
    supported_locales: [...catalog.supported_locales],
    locale_names: { ...catalog.locale_names },
    ui_locales: orderUiLocales([...catalog.ui_locales]),
    ui_locale_names: { ...catalog.ui_locale_names },
    core_sync_locales: catalog.core_sync_locales
      ? { ...catalog.core_sync_locales }
      : { ...FALLBACK.core_sync_locales! },
  };
}

export function getMoabomLocaleCatalog(): MoabomLocaleCatalog {
  if (cached) {
    return cached;
  }
  const g7 = (window as { G7Core?: { config?: { supportedLocales?: string[]; localeNames?: Record<string, string> } } }).G7Core?.config;
  if (g7?.supportedLocales?.length) {
    const supported = orderUiLocales([...g7.supportedLocales]);
    const coreSync: Record<string, string> = {};
    const fallback = supported.includes('en') ? 'en' : (supported[0] ?? 'ko');
    for (const code of FALLBACK.ui_locales) {
      coreSync[code] = supported.includes(code) ? code : fallback;
    }
    return {
      supported_locales: supported,
      locale_names: { ...(g7.localeNames ?? {}) },
      ui_locales: [...FALLBACK.ui_locales],
      ui_locale_names: FALLBACK.ui_locale_names,
      core_sync_locales: coreSync,
    };
  }
  return FALLBACK;
}

export function isMoabomUiLanguage(value: string): value is MoabomSystemLanguage {
  return getMoabomLocaleCatalog().ui_locales.includes(value);
}

export function moabomOverlayLocales(): MoabomSystemLanguage[] {
  return getMoabomLocaleCatalog().ui_locales.filter(isMoabomUiLanguage);
}
