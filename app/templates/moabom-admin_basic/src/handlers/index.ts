/**
 * 커스텀 액션 핸들러 Export
 *
 * 템플릿에서 사용하는 모든 커스텀 핸들러를 정의합니다.
 *
 * setLocale: 템플릿에서 재등록하지 않음 — ActionDispatcher 빌트인이 TemplateApp.changeLocale을 호출합니다.
 */

import { setThemeHandler, initThemeHandler } from './setThemeHandler';
import { scrollToSectionHandler } from './scrollToSectionHandler';
import { initMenuFromUrlHandler } from './initMenuFromUrlHandler';
import {
  initFilterVisibilityHandler,
  saveFilterVisibilityHandler,
  toggleFilterVisibilityHandler,
  resetFilterVisibilityHandler,
} from './filterVisibilityHandler';
import {
  saveMultilingualTagHandler,
  cancelMultilingualTagHandler,
  updateMultilingualTagValueHandler,
} from './multilingualTagHandler';
import { setDateRangeHandler } from './setDateRangeHandler';
import { flushFormBeforeSaveHandler } from './flushFormBeforeSaveHandler';
import { mergeSiteLogoUploadHandler } from './mergeSiteLogoUploadHandler';

/**
 * 핸들러 맵
 *
 * 키: 핸들러 이름 (ActionDispatcher에 등록될 이름)
 * 값: 핸들러 함수
 *
 * 새로운 핸들러 추가 시 여기에만 등록하면 자동으로 ActionDispatcher에 등록됩니다.
 */
export const handlerMap = {
  setTheme: setThemeHandler,
  initTheme: initThemeHandler,
  scrollToSection: scrollToSectionHandler,
  initMenuFromUrl: initMenuFromUrlHandler,
  // 필터 가시성 핸들러
  initFilterVisibility: initFilterVisibilityHandler,
  saveFilterVisibility: saveFilterVisibilityHandler,
  toggleFilterVisibility: toggleFilterVisibilityHandler,
  resetFilterVisibility: resetFilterVisibilityHandler,
  // 다국어 태그 입력 핸들러 (MultilingualTagInput 외부 모달용)
  saveMultilingualTag: saveMultilingualTagHandler,
  cancelMultilingualTag: cancelMultilingualTagHandler,
  updateMultilingualTagValue: updateMultilingualTagValueHandler,
  // 날짜 범위 프리셋 핸들러
  setDateRange: setDateRangeHandler,
  flushFormBeforeSave: flushFormBeforeSaveHandler,
  mergeSiteLogoUpload: mergeSiteLogoUploadHandler,
} as const;
