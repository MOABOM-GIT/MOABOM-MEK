import type { MoabomSystemLanguage, MoabomSystemState } from '../types/moabomSystem';
import { getMoabomLocaleCatalog } from './moabomLocaleCatalog';

/** Moabom UI 언어 → 코어 `users.language` (서버 `locale_catalog.core_sync_locales` SSoT) */
export function coreSyncLanguageFromMoabomPref(pref: MoabomSystemLanguage): string {
  const catalog = getMoabomLocaleCatalog();
  const mapped = catalog.core_sync_locales?.[pref];
  if (mapped) {
    return mapped;
  }
  if (catalog.supported_locales.includes(pref)) {
    return pref;
  }
  if (catalog.supported_locales.includes('en')) {
    return 'en';
  }
  return catalog.supported_locales[0] ?? 'ko';
}

/**
 * 서버 `users.language` 와 Moabom `preferences.language` 정렬.
 * 코어 로케일이 활성 언어팩에 없으면 Moabom UI 선택을 유지합니다.
 */
export function alignMoabomPreferenceWithCoreProfile(
  prefLang: MoabomSystemLanguage,
  coreLang: string | undefined,
): MoabomSystemLanguage {
  const supported = getMoabomLocaleCatalog().supported_locales;
  if (!coreLang || !supported.includes(coreLang)) {
    return prefLang;
  }

  if (coreSyncLanguageFromMoabomPref(prefLang) === coreLang) {
    return prefLang;
  }

  if (supported.includes(prefLang)) {
    return prefLang;
  }

  return coreLang as MoabomSystemLanguage;
}

/**
 * 설정 저장 시 `preferences.language`만 바뀌었는지 판별합니다.
 * 이 경우 전체 `checkAuth` 대신 클라이언트에서 `language`만 맞춰 깜빡임을 줄일 수 있습니다.
 */
export function isMoabomSystemStateLanguageOnlyChange(
  prev: MoabomSystemState,
  next: MoabomSystemState,
): boolean {
  if (prev.preferences.language === next.preferences.language) {
    return false;
  }

  try {
    return (
      JSON.stringify(prev.layout) === JSON.stringify(next.layout)
      && JSON.stringify(prev.appearance) === JSON.stringify(next.appearance)
      && JSON.stringify(prev.preferences.systemOptions) === JSON.stringify(next.preferences.systemOptions)
    );
  } catch {
    return false;
  }
}
