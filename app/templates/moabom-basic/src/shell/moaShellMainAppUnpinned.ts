import { isGeneratedLibraryAppId } from '../apps/generatedAppLibrary';
import { loadJsonSanitizedIds, saveJson } from './moaShellLocalStorage';

/** 메인 패널에서 명시적으로 제거한 AI 생성앱 id (라이브러리에는 유지) */
export const STORAGE_KEY_MAIN_UNPINNED_GENERATED = 'moabom_main_unpinned_generated';

export function loadMainUnpinnedGeneratedIds(): Set<string> {
  const ids = loadJsonSanitizedIds(STORAGE_KEY_MAIN_UNPINNED_GENERATED, []);
  return new Set(ids.filter(isGeneratedLibraryAppId));
}

export function saveMainUnpinnedGeneratedIds(ids: Iterable<string>): void {
  const next = [...ids].filter(isGeneratedLibraryAppId);
  saveJson(STORAGE_KEY_MAIN_UNPINNED_GENERATED, next);
}

export function addMainUnpinnedGeneratedId(appId: string): void {
  if (!isGeneratedLibraryAppId(appId)) {
    return;
  }
  const set = loadMainUnpinnedGeneratedIds();
  if (set.has(appId)) {
    return;
  }
  set.add(appId);
  saveMainUnpinnedGeneratedIds(set);
}

export function removeMainUnpinnedGeneratedId(appId: string): void {
  if (!isGeneratedLibraryAppId(appId)) {
    return;
  }
  const set = loadMainUnpinnedGeneratedIds();
  if (!set.delete(appId)) {
    return;
  }
  saveMainUnpinnedGeneratedIds(set);
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
