import type { MoabomTranslateFn } from '../i18n/moabomT';
import type { MoabomSystemLanguage } from '../types/moabomSystem';
import { getMoabomLocaleCatalog, isMoabomUiLanguage } from './moabomLocaleCatalog';

/** 회원가입 UI에서 선택 가능한 Moabom UI 로케일로 정규화 */
export function normalizeRegisterUiLanguage(value: string | number): MoabomSystemLanguage {
  const raw = String(value);
  if (isMoabomUiLanguage(raw)) {
    return raw;
  }
  const first = getMoabomLocaleCatalog().ui_locales[0];
  return isMoabomUiLanguage(first) ? first : 'ko';
}

/** 회원가입 언어 `<Select>` 옵션 — 마이페이지 설정과 동일한 UI 로케일 집합 */
export function buildAuthLanguageSelectOptions(t: MoabomTranslateFn): { value: string; label: string }[] {
  const { ui_locales, ui_locale_names } = getMoabomLocaleCatalog();
  return ui_locales.map((code) => {
    const key = `moa_mypage.lang_names.${code}`;
    const translated = t(key);
    const label = translated !== key ? translated : (ui_locale_names[code] ?? code);
    return { value: code, label };
  });
}
