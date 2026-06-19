import { createAppShellMetadata } from '../../apps/ai-generator/metadata';
import type { App } from '../../data/Moa_apps';
import { buildMainApps } from './moaHomeAppLists';
import {
  STORAGE_KEY_CREATE_APP_ORDER_MIGRATED,
  STORAGE_KEY_ORDER,
} from './moaHomeConstants';
import { loadJson, loadJsonSanitizedIds, saveJson, stripLegacyAiGeneratorFromIds } from './moaHomeStorage';

export const MOABOM_SHELL_ORDER_CHANGED_EVENT = 'moabom-shell-order-changed';

const MAX_MAIN_APP_ORDER_LENGTH = 64;
const MAX_APP_ID_LENGTH = 128;
const APP_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

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

export function loadLocalMainAppOrder(): string[] {
  return loadJsonSanitizedIds(STORAGE_KEY_ORDER, []);
}

export function saveLocalMainAppOrder(ids: string[]): void {
  const sanitized = sanitizeMainAppOrderIds(ids);
  saveJson(STORAGE_KEY_ORDER, sanitized);
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

/**
 * 로그인 pull 시 메인 order 병합.
 * - 게스트: 로컬만
 * - 저장 쿨다운: 로컬 우선 (테마 저장과 동일)
 * - 서버에 order 있음: 서버 우선 (계정 SSOT)
 * - 서버 비어 있음: 로컬 유지
 */
export function mergeMainAppOrderFromPull(input: {
  isLoggedIn: boolean;
  trustLocalDuringCooldown: boolean;
  localOrder: string[];
  serverOrder: string[] | null;
}): string[] {
  if (!input.isLoggedIn) {
    return input.localOrder;
  }

  if (input.trustLocalDuringCooldown) {
    return input.localOrder;
  }

  if (input.serverOrder !== null) {
    return input.serverOrder;
  }

  return input.localOrder;
}

export function loadInitialMainOrder(): string[] {
  const storedOrder = loadLocalMainAppOrder();
  if (storedOrder.length === 0) {
    return storedOrder;
  }

  const migrated = loadJson<boolean>(STORAGE_KEY_CREATE_APP_ORDER_MIGRATED, false);
  if (migrated || storedOrder.includes(createAppShellMetadata.id)) {
    return storedOrder;
  }

  const next = [createAppShellMetadata.id, ...storedOrder];
  saveLocalMainAppOrder(next);
  saveJson(STORAGE_KEY_CREATE_APP_ORDER_MIGRATED, true);

  return next;
}

export function resolveMainAppsFromOrder(order: string[], extraApps: App[] = []): App[] {
  return buildMainApps(order, extraApps);
}

export function orderIdsFromApps(apps: App[]): string[] {
  return apps.map(app => app.id);
}

/**
 * order가 비어 있으면 “전체 기본 앱” 의미이므로, 첫 편집 시 현재 그리드 id로 구체화한다.
 */
export function materializeOrderForMutation(
  currentOrder: string[],
  visibleApps: App[],
  mutate: (ids: string[]) => string[],
): string[] {
  const baseIds = currentOrder.length === 0 ? orderIdsFromApps(visibleApps) : currentOrder;

  return sanitizeMainAppOrderIds(mutate(baseIds));
}
