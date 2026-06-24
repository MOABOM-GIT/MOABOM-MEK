import { createAppShellMetadata } from '../apps/ai-generator/metadata';
import type { App } from '../data/Moa_apps';
import { buildMainApps, mainPanelGeneratedExtras } from './moaShellAppLists';
import { isGeneratedLibraryAppId } from '../apps/generatedAppLibrary';
import { filterOrderExcludingUnpinned, loadMainUnpinnedGeneratedIds } from './moaShellMainAppUnpinned';
import {
  STORAGE_KEY_CREATE_APP_ORDER_MIGRATED,
  STORAGE_KEY_ORDER,
} from './moaShellLayoutConstants';
import { loadJson, loadJsonSanitizedIds, saveJson, stripLegacyAiGeneratorFromIds } from './moaShellLocalStorage';

export const MOABOM_SHELL_ORDER_CHANGED_EVENT = 'moabom-shell-order-changed';

const MAX_MAIN_APP_ORDER_LENGTH = 64;
const MAX_APP_ID_LENGTH = 128;
const APP_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export interface MainAppOrderSnapshot {
  order: string[];
  customized: boolean;
}

export function isValidShellMainAppId(id: string): boolean {
  return id.length > 0
    && id.length <= MAX_APP_ID_LENGTH
    && APP_ID_PATTERN.test(id);
}

/** order 배열 정규화 — 중복·레거시 id·비정상 id 제거 */
export function sanitizeMainAppOrderIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of ids) {
    if (typeof raw !== 'string') {
      continue;
    }
    const id = stripLegacyAiGeneratorFromIds([raw.trim()])[0];
    if (!id || seen.has(id) || !isValidShellMainAppId(id)) {
      continue;
    }
    seen.add(id);
    result.push(id);
    if (result.length >= MAX_MAIN_APP_ORDER_LENGTH) {
      break;
    }
  }

  return result;
}

/** localStorage 에 order 키가 있으면 사용자가 한 번이라도 편집한 것으로 간주 */
export function hasLocalMainAppOrderCustomized(): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  return localStorage.getItem(STORAGE_KEY_ORDER) !== null;
}

export function loadLocalMainAppOrder(): string[] {
  if (!hasLocalMainAppOrderCustomized()) {
    return [];
  }
  return loadJsonSanitizedIds(STORAGE_KEY_ORDER, []);
}

export function saveLocalMainAppOrder(ids: string[]): void {
  const sanitized = sanitizeMainAppOrderIds(ids);
  saveJson(STORAGE_KEY_ORDER, sanitized);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MOABOM_SHELL_ORDER_CHANGED_EVENT));
  }
}

/** 기본 그리드 복귀 — localStorage order 키 제거 */
export function clearLocalMainAppOrder(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  if (localStorage.getItem(STORAGE_KEY_ORDER) === null) {
    return;
  }
  localStorage.removeItem(STORAGE_KEY_ORDER);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MOABOM_SHELL_ORDER_CHANGED_EVENT));
  }
}

export function extractServerMainAppOrder(settings: Record<string, unknown> | undefined): string[] | null {
  if (!settings || typeof settings !== 'object') {
    return null;
  }

  const shell = settings.shell;
  if (!shell || typeof shell !== 'object') {
    return null;
  }

  const home = (shell as Record<string, unknown>).home;
  if (!home || typeof home !== 'object') {
    return null;
  }

  const order = (home as Record<string, unknown>).mainAppOrder;
  if (!Array.isArray(order)) {
    return null;
  }

  return sanitizeMainAppOrderIds(order);
}

export function extractServerMainAppOrderCustomized(
  settings: Record<string, unknown> | undefined,
): boolean | null {
  if (!settings || typeof settings !== 'object') {
    return null;
  }

  const shell = settings.shell;
  if (!shell || typeof shell !== 'object') {
    return null;
  }

  const home = (shell as Record<string, unknown>).home;
  if (!home || typeof home !== 'object') {
    return null;
  }

  const homeRecord = home as Record<string, unknown>;
  if (typeof homeRecord.mainAppOrderCustomized === 'boolean') {
    return homeRecord.mainAppOrderCustomized;
  }

  if (Array.isArray(homeRecord.mainAppOrder)) {
    return true;
  }

  return null;
}

/**
 * 로그인 pull 시 메인 order 병합.
 * - 게스트: 로컬만
 * - 저장 쿨다운: 로컬 우선 (테마 저장과 동일)
 * - 서버에 customized order: 서버 우선 (계정 SSOT)
 * - 어느 쪽도 미커스텀: 기본 그리드
 */
export function mergeMainAppOrderFromPull(input: {
  isLoggedIn: boolean;
  trustLocalDuringCooldown: boolean;
  localOrder: string[];
  localCustomized: boolean;
  serverOrder: string[] | null;
  serverCustomized: boolean | null;
}): MainAppOrderSnapshot {
  if (!input.isLoggedIn) {
    return { order: input.localOrder, customized: input.localCustomized };
  }

  if (input.trustLocalDuringCooldown) {
    return { order: input.localOrder, customized: input.localCustomized };
  }

  const serverHasCustomLayout = input.serverCustomized === true
    || (input.serverCustomized === null && input.serverOrder !== null);

  if (serverHasCustomLayout) {
    return { order: input.serverOrder ?? [], customized: true };
  }

  if (input.localCustomized) {
    return { order: input.localOrder, customized: true };
  }

  return { order: [], customized: false };
}

export function loadInitialMainOrderSnapshot(): MainAppOrderSnapshot {
  const customized = hasLocalMainAppOrderCustomized();
  const storedOrder = customized ? loadLocalMainAppOrder() : [];

  if (!customized || storedOrder.length === 0) {
    return { order: storedOrder, customized };
  }

  const migrated = loadJson<boolean>(STORAGE_KEY_CREATE_APP_ORDER_MIGRATED, false);
  if (migrated || storedOrder.includes(createAppShellMetadata.id)) {
    return { order: storedOrder, customized };
  }

  const next = [createAppShellMetadata.id, ...storedOrder];
  saveLocalMainAppOrder(next);
  saveJson(STORAGE_KEY_CREATE_APP_ORDER_MIGRATED, true);

  return { order: next, customized: true };
}

/** @deprecated orderRef 초기화용 — `loadInitialMainOrderSnapshot().order` 사용 권장 */
export function loadInitialMainOrder(): string[] {
  return loadInitialMainOrderSnapshot().order;
}

export function resolveMainAppsFromOrder(
  order: string[],
  ownedGeneratedApps: App[] = [],
  catalogGeneratedApps: App[] = [],
  customized = false,
  unpinnedGeneratedIds: ReadonlySet<string> = loadMainUnpinnedGeneratedIds(),
): App[] {
  const effectiveOrder = filterOrderExcludingUnpinned(order, unpinnedGeneratedIds);
  const extras = mainPanelGeneratedExtras(
    effectiveOrder,
    ownedGeneratedApps,
    catalogGeneratedApps,
    customized,
    unpinnedGeneratedIds,
  );

  return buildMainApps(effectiveOrder, extras, { customized });
}

/** API에 없는 `generated-app-*` id 를 order 에서 제거 — 삭제·부팅 placeholder 잔존 방지 */
export function pruneStaleGeneratedAppOrderIds(order: string[], libraryApps: App[]): string[] {
  if (order.length === 0) {
    return order;
  }

  const known = new Set(libraryApps.map(app => app.id));

  return sanitizeMainAppOrderIds(
    order.filter(id => !isGeneratedLibraryAppId(id) || known.has(id)),
  );
}

export function orderIdsFromApps(apps: App[]): string[] {
  return apps.map(app => app.id);
}

/**
 * order가 비어 있고 아직 미커스텀이면 “전체 기본 앱” 의미이므로, 첫 편집 시 현재 그리드 id로 구체화한다.
 */
export function materializeOrderForMutation(
  currentOrder: string[],
  visibleApps: App[],
  mutate: (ids: string[]) => string[],
  customized = false,
): string[] {
  const baseIds = (!customized && currentOrder.length === 0)
    ? orderIdsFromApps(visibleApps)
    : currentOrder;

  return sanitizeMainAppOrderIds(mutate(baseIds));
}
