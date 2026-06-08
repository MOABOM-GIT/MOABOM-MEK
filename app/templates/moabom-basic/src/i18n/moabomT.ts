/**
 * Moabom 템플릿 번역 — 활성 오버레이(JSON)가 있으면 우선하고, 없으면 G7Core.t(엔진 로케일)를 사용합니다.
 */
import {
  interpolateMoabomTemplate,
  lookupMoabomOverlay,
  shouldMoabomTSkipOverlayLookup,
} from './moabomTranslationOverlay';

export type MoabomTranslateFn = (key: string, params?: Record<string, string | number>) => string;

export function moabomT(key: string, params?: Record<string, string | number>): string {
  if (typeof window === 'undefined') {
    return key;
  }

  const overlay = shouldMoabomTSkipOverlayLookup() ? undefined : lookupMoabomOverlay(key);
  if (overlay !== undefined && overlay !== '') {
    return interpolateMoabomTemplate(overlay, params);
  }

  const G7Core = (window as any).G7Core;
  const raw = G7Core?.t?.(key, params);
  if (raw !== undefined && raw !== null) {
    const s = String(raw);
    /** 코어가 미번역 키에 빈 문자열을 줄 때 오버레이 폴백을 막지 않도록 동일 취급 */
    if (s !== '' && s.trim() !== '') {
      return s;
    }
  }
  return key;
}
