import type { WindowState } from '../components/composite/Moa_CenterPanel';
import { createAppShellMetadata } from '../apps/ai-generator/metadata';
import { smartChatShellMetadata } from '../apps/ai-smart-chat/metadata';
import { appendNewShellBootApps } from '../apps/shellBootApps';
import { APPS, type App } from '../data/Moa_apps';
import {
  MAX_RECENT_APPS,
  MAX_TASKBAR_ITEMS,
  MOA_SHELL_POINT_TITLE_GRADIENT,
} from './moaShellLayoutConstants';
import { LEGACY_AI_GENERATOR_APP_ID } from './moaShellLocalStorage';

/**
 * 정적 APPS + shell-boot 매니페스트(신규 id 만) 합본 — 가산(무손상).
 * 부트 앱이 없으면 [...APPS] 와 동일.
 */
/** 동일 id 앞쪽 항목 우선 (owned → shared 순 병합 시 사용) */
export function dedupeAppsById(apps: App[]): App[] {
  const seen = new Set<string>();
  const result: App[] = [];

  for (const app of apps) {
    if (seen.has(app.id)) continue;
    seen.add(app.id);
    result.push(app);
  }

  return result;
}

/** 시스템 도구 앱 — 메인 그리드 선두 (마이앱 제외) */
export const SYSTEM_TOOL_APP_METADATA: App[] = [
  createAppShellMetadata,
  smartChatShellMetadata,
];

function allGridApps(extraApps: App[] = []): App[] {
  const apps = appendNewShellBootApps([...SYSTEM_TOOL_APP_METADATA, ...APPS]);
  const seen = new Set(apps.map(app => app.id));
  for (const app of extraApps) {
    if (!seen.has(app.id)) {
      apps.push(app);
      seen.add(app.id);
    }
  }

  return apps;
}

export interface BuildMainAppsOptions {
  /** false = 첫 방문 기본 그리드(전체 앱), true = order SSOT(빈 배열이면 빈 그리드) */
  customized?: boolean;
}

/** 메인 그리드용 생성앱 — 기본 레이아웃은 소유 앱 전체, 커스텀 레이아웃은 order 에 고정된 것만 */
export function mainPanelGeneratedExtras(
  order: string[],
  ownedApps: App[],
  catalogApps: App[],
  customized = false,
  unpinnedGeneratedIds: ReadonlySet<string> = new Set(),
): App[] {
  const isAllowedOnMain = (app: App) => !unpinnedGeneratedIds.has(app.id);

  if (!customized) {
    return ownedApps.filter(isAllowedOnMain);
  }

  if (order.length === 0) {
    return [];
  }

  const orderSet = new Set(order);
  const ownedIds = new Set(ownedApps.map(app => app.id));
  const pinnedOwned = ownedApps.filter(app => orderSet.has(app.id) && isAllowedOnMain(app));
  const pinnedCatalog = catalogApps.filter(
    app => orderSet.has(app.id) && !ownedIds.has(app.id) && isAllowedOnMain(app),
  );

  return dedupeAppsById([...pinnedOwned, ...pinnedCatalog]);
}

/**
 * 메인 그리드 앱 목록 생성.
 * - customized=false: 전체 기본 앱(정적 + 부트 매니페스트 + extras). `APPS[0]` 소개 앱 포함.
 * - customized=true: order 에 명시된 id 만 (빈 order → 빈 그리드). 삭제한 앱은 재삽입하지 않음.
 */
export function buildMainApps(
  order: string[],
  extraApps: App[] = [],
  options: BuildMainAppsOptions = {},
): App[] {
  const customized = options.customized ?? false;
  const apps = allGridApps(extraApps);
  if (!customized) {
    return apps;
  }

  const appMap = new Map(apps.map(a => [a.id, a]));
  const result: App[] = [];

  for (const id of order) {
    const app = appMap.get(id);
    if (app) result.push(app);
  }
  return result;
}

export function buildFavoriteApps(favoriteIds: string[], extraApps: App[] = []): App[] {
  const appMap = new Map(allGridApps(extraApps).map(a => [a.id, a]));
  const result: App[] = [];

  for (const id of favoriteIds) {
    const app = appMap.get(id);
    if (app) result.push(app);
  }

  return result;
}

export function buildMyApps(createdApps: App[] = []): App[] {
  const systemIds = new Set(SYSTEM_TOOL_APP_METADATA.map(app => app.id));
  return createdApps.filter(app => !systemIds.has(app.id));
}

export function buildRecentApps(recentIds: string[], extraApps: App[] = []): App[] {
  const appMap = new Map(allGridApps(extraApps).map(a => [a.id, a]));
  const result: App[] = [];

  for (const id of recentIds) {
    const app = appMap.get(id);
    if (app && app.id !== 'mypage') result.push(app);
    if (result.length >= MAX_RECENT_APPS) break;
  }

  return result;
}

export function normalizeTaskbarItems(items: Partial<WindowState>[]): WindowState[] {
  const systemToolById = new Map(SYSTEM_TOOL_APP_METADATA.map(app => [app.id, app]));

  return items
    .filter(item => item.id && item.appId)
    .slice(0, MAX_TASKBAR_ITEMS)
    .map((item) => {
      let appId = String(item.appId);
      if (appId === LEGACY_AI_GENERATOR_APP_ID) {
        appId = createAppShellMetadata.id;
      }
      const systemTool = systemToolById.get(appId);
      const usePointTitleGradient = appId === 'mypage';
      const title = typeof item.title === 'string' && item.title.trim()
        ? item.title
        : (systemTool?.name ?? appId);
      const icon = systemTool?.icon
        ?? (typeof item.icon === 'string' && item.icon ? item.icon : 'cube');
      const gradient = systemTool?.gradient
        ?? (usePointTitleGradient
          ? MOA_SHELL_POINT_TITLE_GRADIENT
          : (typeof item.gradient === 'string' && item.gradient
            ? item.gradient
            : MOA_SHELL_POINT_TITLE_GRADIENT));
      return {
        id: String(item.id),
        appId,
        title,
        icon,
        gradient,
        zIndex: 0,
        initialX: item.initialX,
        initialY: item.initialY,
        isMaximized: false,
        isMinimized: true,
        myPageInitialTab: item.myPageInitialTab,
        editGeneratedAppId: item.editGeneratedAppId,
        isGenerationBackground: item.isGenerationBackground,
        boardSlug: item.boardSlug,
        boardPostId: item.boardPostId,
        appCommunityServerId: item.appCommunityServerId,
        appCommunityTitle: item.appCommunityTitle,
        appCommunityCanWrite: item.appCommunityCanWrite,
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
