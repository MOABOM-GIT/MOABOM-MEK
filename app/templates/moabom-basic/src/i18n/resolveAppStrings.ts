/**
 * 앱 표시 문자열 해석 — API 다국어(i18n 맵) → 템플릿 moa_apps.* 키 → 원문(name/description)
 */
import type { App } from '../data/Moa_apps';
import type { MoabomSystemLanguage } from '../types/moabomSystem';
import type { MoabomTranslateFn } from './moabomT';
import { isMoabomOverlaySyncedToLocale, lookupMoabomOverlay } from './moabomTranslationOverlay';
import { resolveMoabomSiteDisplayName } from '../utils/moabomSiteBranding';

const MOA_APPS_PREFIX = 'moa_apps';

export interface ResolvedAppStrings {
  name: string;
  description: string;
}

/**
 * moa_apps.* 카탈로그 문자열:
 * - 오버레이가 **요청 로케일과 동기화**된 경우에만 오버레이 값을 사용한다(비동기 로드 전 이전 로케일 캐시 배제).
 * - 동기화된 오버레이에 키가 없으면 undefined — 부분 오버레이에서 코어 영문이 원문을 덮는 것 방지.
 * - 동기화되지 않았거나 오버레이 없음: 카탈로그를 읽지 않고 metadata/API 값으로 폴백한다.
 */
function resolveCatalogTemplateString(
  key: string,
  locale: MoabomSystemLanguage,
): string | undefined {
  if (!isMoabomOverlaySyncedToLocale(locale)) {
    return undefined;
  }
  const fromOverlay = lookupMoabomOverlay(key);
  if (fromOverlay !== undefined && fromOverlay !== '') {
    return fromOverlay;
  }
  return undefined;
}

/**
 * 활성 로케일에 맞는 앱 이름·설명을 반환합니다.
 *
 * 우선순위:
 * 1. app.i18n[locale] (사용자 생성·백엔드 MT 등 동적 번역)
 * 2. 템플릿 오버레이의 moa_apps.{id}.name | .description (없으면 다음 단계)
 * 3. app.name, app.description (작성자 원문·기본 카탈로그)
 */
export function resolveAppStrings(
  app: App,
  locale: MoabomSystemLanguage,
): ResolvedAppStrings {
  if (app.id === 'hospital-info') {
    return {
      name: resolveMoabomSiteDisplayName(),
      description: app.i18n?.[locale]?.description?.trim()
        || resolveCatalogTemplateString(`${MOA_APPS_PREFIX}.${app.id}.description`, locale)
        || app.description,
    };
  }

  const fromLocale = app.i18n?.[locale];
  const nameFromApi = fromLocale?.name?.trim();
  const descFromApi = fromLocale?.description?.trim();

  const nameKey = `${MOA_APPS_PREFIX}.${app.id}.name`;
  const descKey = `${MOA_APPS_PREFIX}.${app.id}.description`;
  const nameFromTpl = resolveCatalogTemplateString(nameKey, locale);
  const descFromTpl = resolveCatalogTemplateString(descKey, locale);

  const metadataName = app.name?.trim() || '';
  const metadataDesc = app.description?.trim() || '';

  const name =
    (nameFromApi && nameFromApi.length > 0 ? nameFromApi : undefined)
    ?? nameFromTpl
    ?? metadataName;

  const description =
    (descFromApi && descFromApi.length > 0 ? descFromApi : undefined)
    ?? descFromTpl
    ?? metadataDesc;

  return { name, description };
}

export function resolveAuthWindowTitle(appId: string, t: MoabomTranslateFn): string {
  const keyMap: Record<string, string> = {
    login: 'moa_shell.auth_windows.login',
    register: 'moa_shell.auth_windows.register',
    'forgot-password': 'moa_shell.auth_windows.forgot_password',
    'reset-password': 'moa_shell.auth_windows.reset_password',
  };
  const key = keyMap[appId];
  if (!key) {
    return appId;
  }
  const resolved = t(key);
  return resolved !== key ? resolved : appId;
}

/**
 * 태스크바·윈도우 타이틀용 — 인증 창은 항상 현재 로케일 기준 문자열을 재계산합니다.
 */
export function resolveWindowTitle(
  win: { appId: string; title: string },
  appsById: Map<string, App>,
  locale: MoabomSystemLanguage,
  t: MoabomTranslateFn,
  authAppIds: readonly string[],
): string {
  if (authAppIds.includes(win.appId)) {
    return resolveAuthWindowTitle(win.appId, t);
  }
  const app = appsById.get(win.appId);
  if (!app) {
    return win.title;
  }
  return resolveAppStrings(app, locale).name;
}
