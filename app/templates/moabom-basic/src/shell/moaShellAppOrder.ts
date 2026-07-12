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

export function extractServerRecentAppIds(settings: Record<string, unknown> | undefined): string[] | null {
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

  const recentIds = (home as Record<string, unknown>).recentAppIds;
  if (!Array.isArray(recentIds)) {
    return null;
  }

  return sanitizeMainAppOrderIds(recentIds);
}

export function mergeRecentAppIdsFromPull(input: {
  isLoggedIn: boolean;
  trustLocalDuringCooldown: boolean;
  localIds: string[];
  serverIds: string[] | null;
}): string[] {
  if (!input.isLoggedIn) {
    return input.localIds;
  }

  if (input.trustLocalDuringCooldown) {
    return input.localIds;
  }

  if (input.serverIds !== null) {
    return input.serverIds;
  }

  return input.localIds;
}

/**
 * 로그인 pull 시 메인 order 병합.
 * - 게스트: 로컬만
 * - dirty/미ACK: 로컬 우선 (공개앱 pin 등이 서버 구 order 로 롤백되지 않음)
 * - 로컬 customized 이고 서버 order 가 로컬의 진부분집합(누락)이면 로컬 유지 + 재동기화 유도
 * - 서버에 customized order 이고 로컬이 미커스텀/동일 계열: 서버 우선 (계정 SSOT)
 * - 어느 쪽도 미커스텀: 기본 그리드
 *
 * 삭제 후 stale generated-app-* 재주입 방지는 백엔드 destroy prune + library reconcile 이 SSOT.
 * (타기기 pin 과 로컬 삭제를 merge 만으로 구분할 수 없음)
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

  if (input.localCustomized) {
    const serverOrder = input.serverOrder ?? [];
    if (!serverHasCustomLayout) {
      return { order: input.localOrder, customized: true };
    }
    // 서버가 로컬 pin 일부를 아직 모르는 구버전이면 로컬 유지 (pull 롤백 방지)
    if (isLocalMainOrderAheadOfServer(input.localOrder, serverOrder)) {
      return { order: input.localOrder, customized: true };
    }
    return { order: serverOrder, customized: true };
  }

  if (serverHasCustomLayout) {
    return { order: input.serverOrder ?? [], customized: true };
  }

  return { order: [], customized: false };
}

/** 서버 order 가 로컬의 진부분집합이면 로컬이 pin 추가한 최신본으로 본다 */
export function isLocalMainOrderAheadOfServer(localOrder: string[], serverOrder: string[]): boolean {
  if (localOrder.length === 0 || serverOrder.length >= localOrder.length) {
    return false;
  }
  const localSet = new Set(localOrder);
  const serverSet = new Set(serverOrder);
  return serverOrder.every(id => localSet.has(id)) && localOrder.some(id => !serverSet.has(id));
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
