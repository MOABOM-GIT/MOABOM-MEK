/**
 * 번역 오버레이 상태는 메인 `components.iife.js` 에서만 갱신됩니다.
 * 셸 지연 로드 IIFE(cpap-mask 등)가 동일 모듈을 다시 묶으면 `isMoabomOverlaySyncedToLocale` 이
 * 항상 false 로 남아 앱이 "…" 에서 멈추거나 언어 전환이 반영되지 않습니다.
 *
 * @see window.__MoabomShellOverlay (메인 `src/index.ts`에서 주입)
 */
export {
  clearMoabomTranslationOverlay,
  clearShellUiTranslationLocaleHint,
  interpolateMoabomTemplate,
  isMoabomOverlayLocaleActive,
  isMoabomOverlaySyncedToLocale,
  loadMoabomTranslationOverlay,
  lookupMoabomOverlay,
  setShellUiTranslationLocale,
  shouldMoabomTSkipOverlayLookup,
} from './moabomTranslationOverlay';
