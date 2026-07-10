/**
 * 셸 창·태스크바 chrome 파생 SSOT.
 * WindowState 의 title/icon/gradient 는 seed·특수 창용이며,
 * 카탈로그에 있는 앱(특히 generated-app-*)은 렌더 시 appsById 가 승한다.
 */
import type { WindowState } from '../components/composite/Moa_CenterPanel';
import type { App } from '../data/Moa_apps';
import { createAppShellMetadata } from '../apps/ai-generator/metadata';
import { isGeneratedLibraryAppId } from '../apps/generatedAppLibrary';
import { resolveAppStrings } from '../i18n/resolveAppStrings';
import type { MoabomSystemLanguage } from '../types/moabomSystem';
import { MOA_SHELL_POINT_TITLE_GRADIENT } from './moaShellLayoutConstants';

export interface ShellWindowChrome {
  title: string;
  icon: string;
  gradient: string;
  iconImageUrl?: string;
}

function chromeFromApp(app: App, locale: MoabomSystemLanguage, titleFallback: string): ShellWindowChrome {
  const { name } = resolveAppStrings(app, locale);
  const iconImageUrl = app.iconImageUrl?.trim()
    || (typeof app.metadata?.iconImageUrl === 'string' ? app.metadata.iconImageUrl.trim() : '');

  return {
    title: name || titleFallback,
    icon: app.icon,
    gradient: app.gradient,
    ...(iconImageUrl ? { iconImageUrl } : {}),
  };
}

function chromeFromWindowSeed(win: WindowState): ShellWindowChrome {
  return {
    title: win.title,
    icon: win.icon,
    gradient: win.gradient,
  };
}

/**
 * 열린 창·태스크바 버튼에 표시할 chrome 을 카탈로그에서 파생한다.
 */
export function resolveShellWindowChrome(
  win: WindowState,
  appsById: Map<string, App>,
  locale: MoabomSystemLanguage,
): ShellWindowChrome {
  if (win.appId === createAppShellMetadata.id) {
    return {
      title: win.title || createAppShellMetadata.name,
      icon: createAppShellMetadata.icon,
      gradient: createAppShellMetadata.gradient,
    };
  }

  if (win.appId === 'mypage') {
    const catalog = appsById.get('mypage');
    if (catalog) {
      const fromCatalog = chromeFromApp(catalog, locale, win.title);
      return { ...fromCatalog, gradient: MOA_SHELL_POINT_TITLE_GRADIENT };
    }
    return {
      ...chromeFromWindowSeed(win),
      gradient: MOA_SHELL_POINT_TITLE_GRADIENT,
    };
  }

  const catalogApp = appsById.get(win.appId);
  if (catalogApp) {
    return chromeFromApp(catalogApp, locale, win.title);
  }

  if (isGeneratedLibraryAppId(win.appId)) {
    // 딥링크 초기·카탈로그 miss — seed 유지(합성 앱은 그리드에 넣지 않음)
    return chromeFromWindowSeed(win);
  }

  return chromeFromWindowSeed(win);
}
