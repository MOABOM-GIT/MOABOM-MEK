import type { App } from '../data/Moa_apps';
import { buildMainApps, mainPanelGeneratedExtras } from './moaShellAppLists';
import { isGeneratedLibraryAppId } from '../apps/generatedAppLibrary';
import { filterOrderExcludingUnpinned, loadMainUnpinnedGeneratedIds } from './moaShellMainAppUnpinned';
import { STORAGE_KEY_ORDER } from './moaShellLayoutConstants';
import { loadJson, loadJsonSanitizedIds, saveJson, stripLegacyAiGeneratorFromIds } from './moaShellLocalStorage';

export const MOABOM_SHELL_ORDER_CHANGED_EVENT = 'moabom-shell-order-changed';

const MAX_MAIN_APP_ORDER_LENGTH = 64;
const MAX_APP_ID_LENGTH = 128;
const APP_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const STORAGE_KEY_ORDER_BY_SCOPE = 'moabom_main_order_v2';

export interface MainAppOrderSnapshot {
  order: string[];
  customized: boolean;
}

interface MainAppOrderByScopeStorage {
  version: 1;
  byScope: Record<string, MainAppOrderSnapshot>;
}

let activeMainAppOrderScopeKey = 'guest';

export function setActiveMainAppOrderScopeKey(scopeKey: string): void {
  activeMainAppOrderScopeKey = scopeKey || 'guest';
}

export function getActiveMainAppOrderScopeKey(): string {
  return activeMainAppOrderScopeKey;
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

function emptyScopedOrderStorage(): MainAppOrderByScopeStorage {
  return { version: 1, byScope: {} };
}

function migrateLegacyOrderIfNeeded(
  storage: MainAppOrderByScopeStorage,
): MainAppOrderByScopeStorage {
  if (typeof localStorage === 'undefined') {
    return storage;
  }

  const legacyRaw = localStorage.getItem(STORAGE_KEY_ORDER);
  if (legacyRaw === null) {
    return storage;
  }

  const legacyOrder = loadJsonSanitizedIds(STORAGE_KEY_ORDER, []);
  localStorage.removeItem(STORAGE_KEY_ORDER);
  const next: MainAppOrderByScopeStorage = {
    ...storage,
    byScope: {
      ...storage.byScope,
      guest: { order: legacyOrder, customized: true },
    },
  };
  saveJson(STORAGE_KEY_ORDER_BY_SCOPE, next);
  return next;
}

function readScopedOrderStorage(): MainAppOrderByScopeStorage {
  const raw = loadJson<MainAppOrderByScopeStorage | null>(STORAGE_KEY_ORDER_BY_SCOPE, null);
  const storage = raw?.version === 1 && raw.byScope && typeof raw.byScope === 'object'
    ? raw
    : emptyScopedOrderStorage();
  return migrateLegacyOrderIfNeeded(storage);
}

function writeScopedOrderStorage(storage: MainAppOrderByScopeStorage): void {
  saveJson(STORAGE_KEY_ORDER_BY_SCOPE, storage);
}

function dispatchMainAppOrderChanged(scopeKey: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MOABOM_SHELL_ORDER_CHANGED_EVENT, {
      detail: { scopeKey },
    }));
  }
}

/** 현재 계정 스코프에 order가 있으면 사용자가 한 번이라도 편집한 것으로 간주 */
export function hasLocalMainAppOrderCustomized(
  scopeKey: string = getActiveMainAppOrderScopeKey(),
): boolean {
  return readScopedOrderStorage().byScope[scopeKey]?.customized === true;
}

export function loadLocalMainAppOrder(
  scopeKey: string = getActiveMainAppOrderScopeKey(),
): string[] {
  const snapshot = readScopedOrderStorage().byScope[scopeKey];
  if (!snapshot?.customized) {
    return [];
  }
  return sanitizeMainAppOrderIds(snapshot.order);
}

export function saveLocalMainAppOrder(
  ids: string[],
  scopeKey: string = getActiveMainAppOrderScopeKey(),
): void {
  const sanitized = sanitizeMainAppOrderIds(ids);
  const storage = readScopedOrderStorage();
  storage.byScope[scopeKey] = { order: sanitized, customized: true };
  writeScopedOrderStorage(storage);
  dispatchMainAppOrderChanged(scopeKey);
}

/** 현재 계정 스코프를 기본 그리드로 복귀 */
export function clearLocalMainAppOrder(
  scopeKey: string = getActiveMainAppOrderScopeKey(),
): void {
  const storage = readScopedOrderStorage();
  if (!storage.byScope[scopeKey]) {
    return;
  }
  delete storage.byScope[scopeKey];
  writeScopedOrderStorage(storage);
  dispatchMainAppOrderChanged(scopeKey);
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

export function loadInitialMainOrderSnapshot(
  scopeKey: string = getActiveMainAppOrderScopeKey(),
): MainAppOrderSnapshot {
  const customized = hasLocalMainAppOrderCustomized(scopeKey);
  const storedOrder = customized ? loadLocalMainAppOrder(scopeKey) : [];
  return { order: storedOrder, customized };
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
