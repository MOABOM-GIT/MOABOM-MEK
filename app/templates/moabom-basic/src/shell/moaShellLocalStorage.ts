/** Moabom 홈 셸 localStorage 유틸 */

export const LEGACY_AI_GENERATOR_APP_ID = 'ai-generator';

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function stripLegacyAiGeneratorFromIds(ids: string[]): string[] {
  return ids.filter(id => id !== LEGACY_AI_GENERATOR_APP_ID);
}

/** localStorage 에 남은 `ai-generator` id 를 제거하고 필요 시 저장한다 */
export function loadJsonSanitizedIds(storageKey: string, fallback: string[]): string[] {
  const raw = loadJson<string[]>(storageKey, fallback);
  const next = stripLegacyAiGeneratorFromIds(raw);
  if (next.length !== raw.length) {
    saveJson(storageKey, next);
  }
  return next;
}
