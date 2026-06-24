import { isGeneratedLibraryAppId } from '../apps/generatedAppLibrary';
import { resolveGeneratedLibraryScopeKey } from '../apps/generatedAppLibraryAuthority';
import { loadJson, loadJsonSanitizedIds, saveJson } from './moaShellLocalStorage';

/** @deprecated v1 flat list — 읽기 호환 후 guest 스코프로 이전 */
export const STORAGE_KEY_MAIN_UNPINNED_GENERATED = 'moabom_main_unpinned_generated';
const STORAGE_KEY_MAIN_UNPINNED_BY_SCOPE = 'moabom_main_unpinned_generated_v2';

interface MainUnpinnedByScopeStorage {
  version: 1;
  byScope: Record<string, string[]>;
}

let activeUnpinnedScopeKey = 'guest';

export function resolveMainUnpinnedScopeKey(
  isLoggedIn: boolean,
  memberKey?: string | null,
): string {
  return resolveGeneratedLibraryScopeKey(isLoggedIn, memberKey);
}

/** 로그인·로그아웃 시 활성 unpinned 스코프 SSOT */
export function setActiveMainUnpinnedScopeKey(scopeKey: string): void {
  activeUnpinnedScopeKey = scopeKey || 'guest';
}

export function getActiveMainUnpinnedScopeKey(): string {
  return activeUnpinnedScopeKey;
}

function emptyStorage(): MainUnpinnedByScopeStorage {
  return { version: 1, byScope: {} };
}

function readStorage(): MainUnpinnedByScopeStorage {
  const raw = loadJson<MainUnpinnedByScopeStorage | null>(STORAGE_KEY_MAIN_UNPINNED_BY_SCOPE, null);
  if (!raw || raw.version !== 1 || typeof raw.byScope !== 'object') {
    return migrateLegacyUnpinnedIfNeeded(emptyStorage());
  }

  return migrateLegacyUnpinnedIfNeeded(raw);
}

function writeStorage(storage: MainUnpinnedByScopeStorage): void {
  saveJson(STORAGE_KEY_MAIN_UNPINNED_BY_SCOPE, storage);
}

function migrateLegacyUnpinnedIfNeeded(storage: MainUnpinnedByScopeStorage): MainUnpinnedByScopeStorage {
  if (typeof localStorage === 'undefined') {
    return storage;
  }

  const legacyRaw = localStorage.getItem(STORAGE_KEY_MAIN_UNPINNED_GENERATED);
  if (legacyRaw === null) {
    return storage;
  }

  const legacyIds = loadJsonSanitizedIds(STORAGE_KEY_MAIN_UNPINNED_GENERATED, [])
    .filter(isGeneratedLibraryAppId);
  localStorage.removeItem(STORAGE_KEY_MAIN_UNPINNED_GENERATED);

  if (legacyIds.length === 0) {
    return storage;
  }

  const guestIds = new Set(storage.byScope.guest ?? []);
  legacyIds.forEach(id => guestIds.add(id));
  const next = {
    ...storage,
    byScope: {
      ...storage.byScope,
      guest: [...guestIds],
    },
  };
  writeStorage(next);

  return next;
}

export function loadMainUnpinnedGeneratedIds(
  scopeKey: string = getActiveMainUnpinnedScopeKey(),
): Set<string> {
  const storage = readStorage();
  const ids = storage.byScope[scopeKey] ?? [];

  return new Set(ids.filter(isGeneratedLibraryAppId));
}

export function saveMainUnpinnedGeneratedIds(
  ids: Iterable<string>,
  scopeKey: string = getActiveMainUnpinnedScopeKey(),
): void {
  const next = [...ids].filter(isGeneratedLibraryAppId);
  const storage = readStorage();
  storage.byScope[scopeKey] = next;
  writeStorage(storage);
}

export function addMainUnpinnedGeneratedId(
  appId: string,
  scopeKey: string = getActiveMainUnpinnedScopeKey(),
): void {
  if (!isGeneratedLibraryAppId(appId)) {
    return;
  }
  const set = loadMainUnpinnedGeneratedIds(scopeKey);
  if (set.has(appId)) {
    return;
  }
  set.add(appId);
  saveMainUnpinnedGeneratedIds(set, scopeKey);
}

export function removeMainUnpinnedGeneratedId(
  appId: string,
  scopeKey: string = getActiveMainUnpinnedScopeKey(),
): void {
  if (!isGeneratedLibraryAppId(appId)) {
    return;
  }
  const set = loadMainUnpinnedGeneratedIds(scopeKey);
  if (!set.delete(appId)) {
    return;
  }
  saveMainUnpinnedGeneratedIds(set, scopeKey);
}

/** @deprecated pull 시 호출하지 않음 — 서버 `mainUnpinnedGeneratedIds` SSOT 로 대체 */
export function reconcileMainUnpinnedWithOrder(
  order: string[],
  scopeKey: string = getActiveMainUnpinnedScopeKey(),
): void {
  if (order.length === 0) {
    return;
  }

  const set = loadMainUnpinnedGeneratedIds(scopeKey);
  let changed = false;

  for (const id of order) {
    if (set.delete(id)) {
      changed = true;
    }
  }

  if (changed) {
    saveMainUnpinnedGeneratedIds(set, scopeKey);
  }
}

export function filterOrderExcludingUnpinned(
  order: string[],
  unpinned: ReadonlySet<string> = loadMainUnpinnedGeneratedIds(),
): string[] {
  if (unpinned.size === 0) {
    return order;
  }
  return order.filter(id => !unpinned.has(id));
}

export function sanitizeMainUnpinnedGeneratedIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of ids) {
    if (typeof raw !== 'string') {
      continue;
    }
    const id = raw.trim();
    if (!id || seen.has(id) || !isGeneratedLibraryAppId(id)) {
      continue;
    }
    seen.add(id);
    result.push(id);
    if (result.length >= 64) {
      break;
    }
  }

  return result;
}

export function extractServerMainUnpinnedGeneratedIds(
  settings: Record<string, unknown> | undefined,
): string[] | null {
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

  const unpinned = (home as Record<string, unknown>).mainUnpinnedGeneratedIds;
  if (!Array.isArray(unpinned)) {
    return null;
  }

  return sanitizeMainUnpinnedGeneratedIds(unpinned);
}

/**
 * 로그인 pull 시 unpinned 병합.
 * - 게스트: 로컬만
 * - 저장 쿨다운: 로컬 우선
 * - 서버에 필드가 있으면 서버 SSOT (계정·기기 간 동기화)
 */
export function mergeMainUnpinnedFromPull(input: {
  isLoggedIn: boolean;
  trustLocalDuringCooldown: boolean;
  localUnpinned: string[];
  serverUnpinned: string[] | null;
}): string[] {
  if (!input.isLoggedIn) {
    return sanitizeMainUnpinnedGeneratedIds(input.localUnpinned);
  }

  if (input.trustLocalDuringCooldown) {
    return sanitizeMainUnpinnedGeneratedIds(input.localUnpinned);
  }

  if (input.serverUnpinned !== null) {
    return sanitizeMainUnpinnedGeneratedIds(input.serverUnpinned);
  }

  return sanitizeMainUnpinnedGeneratedIds(input.localUnpinned);
}
