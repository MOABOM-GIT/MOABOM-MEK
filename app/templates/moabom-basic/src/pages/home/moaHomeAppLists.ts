import type { WindowState } from '../../components/composite/Moa_CenterPanel';
import { createAppShellMetadata } from '../../apps/ai-generator/metadata';
import { appendNewShellBootApps } from '../../apps/shellBootApps';
import { APPS, type App } from '../../data/Moa_apps';
import {
  MAX_RECENT_APPS,
  MAX_TASKBAR_ITEMS,
  MOA_SHELL_POINT_TITLE_GRADIENT,
} from './moaHomeConstants';
import { LEGACY_AI_GENERATOR_APP_ID } from './moaHomeStorage';

/**
 * 정적 APPS + shell-boot 매니페스트(신규 id 만) 합본 — 가산(무손상).
 * 부트 앱이 없으면 [...APPS] 와 동일.
 */
function allGridApps(): App[] {
  return appendNewShellBootApps([...APPS]);
}

/**
 * 메인 그리드 앱 목록 생성 (순서 반영, order에 없는 앱은 표시 안 함)
 * order가 비어있으면 전체 앱(정적 + 신규 매니페스트) 반환 (초기 상태)
 */
export function buildMainApps(order: string[]): App[] {
  const apps = allGridApps();
  if (order.length === 0) return apps;

  const appMap = new Map(apps.map(a => [a.id, a]));
  const result: App[] = [];

  for (const id of order) {
    const app = appMap.get(id);
    if (app) result.push(app);
  }
  return result;
}

export function buildFavoriteApps(favoriteIds: string[]): App[] {
  const appMap = new Map(allGridApps().map(a => [a.id, a]));
  const result: App[] = [];

  for (const id of favoriteIds) {
    const app = appMap.get(id);
    if (app) result.push(app);
  }

  return result;
}

export function buildRecentApps(recentIds: string[]): App[] {
  const appMap = new Map(allGridApps().map(a => [a.id, a]));
  const result: App[] = [];

  for (const id of recentIds) {
    const app = appMap.get(id);
    if (app && app.id !== 'mypage') result.push(app);
    if (result.length >= MAX_RECENT_APPS) break;
  }

  return result;
}

export function normalizeTaskbarItems(items: Partial<WindowState>[]): WindowState[] {
  return items
    .filter(item => item.id && item.appId && item.title && item.icon && item.gradient)
    .slice(0, MAX_TASKBAR_ITEMS)
    .map((item) => {
      let appId = String(item.appId);
      if (appId === LEGACY_AI_GENERATOR_APP_ID) {
        appId = createAppShellMetadata.id;
      }
      const useCreateMeta = appId === createAppShellMetadata.id;
      const usePointTitleGradient = appId === 'mypage';
      return {
        id: String(item.id),
        appId,
        title: String(item.title),
        icon: useCreateMeta ? createAppShellMetadata.icon : String(item.icon),
        gradient: useCreateMeta
          ? createAppShellMetadata.gradient
          : usePointTitleGradient
            ? MOA_SHELL_POINT_TITLE_GRADIENT
            : String(item.gradient),
        zIndex: 0,
        initialX: item.initialX,
        initialY: item.initialY,
        isMaximized: false,
        isMinimized: true,
        myPageInitialTab: item.myPageInitialTab,
        editGeneratedAppId: item.editGeneratedAppId,
      };
    });
}

export function toTaskbarItem(win: WindowState): WindowState {
  return {
    ...win,
    zIndex: 0,
    isMaximized: false,
    isMinimized: true,
  };
}
