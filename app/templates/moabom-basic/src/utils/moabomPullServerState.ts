import type { MoabomSystemDefaults, MoabomSystemState } from '../types/moabomSystem';
import { loadMoabomSettingsPayloadForMerge } from '../api/moabomSystemApi';
import {
  extractServerMainAppOrder,
  extractServerMainAppOrderCustomized,
  extractServerRecentAppIds,
  hasLocalMainAppOrderCustomized,
  loadLocalMainAppOrder,
  mergeMainAppOrderFromPull,
  isLocalMainOrderAheadOfServer,
  mergeRecentAppIdsFromPull,
  saveLocalMainAppOrder,
  clearLocalMainAppOrder,
  type MainAppOrderSnapshot,
} from '../shell/moaShellAppOrder';
import { queueSaveMoabomSystemSettings, isRecentlySavedSettings } from './moabomSettingsSaveQueue';
import { isShellHomeDirty, queueSaveShellHomeSettings } from './moabomShellOrderSaveQueue';
import { isRecentlySavedRecentAppIds, queueSaveRecentAppIds } from './moabomShellRecentAppsSaveQueue';
import {
  extractServerMainUnpinnedGeneratedIds,
  filterOrderExcludingUnpinned,
  loadMainUnpinnedGeneratedIds,
  mergeMainUnpinnedFromPull,
  saveMainUnpinnedGeneratedIds,
} from '../shell/moaShellMainAppUnpinned';
import { mergeMoabomSystemStateFromSettingsApi, writeStoredMoabomDefaultsRevision } from './moabomSystemServerMerge';
import { areMoabomSystemStatesEqual } from './moabomSystemStore';
import { applyMoabomSystemAppearance, hasStoredMoabomSystemState, loadMoabomSystemState, saveMoabomSystemState } from './moabomSystemStore';
import { STORAGE_KEY_RECENT_APPS } from '../shell/moaShellLayoutConstants';
import { loadJsonSanitizedIds, saveJson } from '../shell/moaShellLocalStorage';
import { runMoabomShellRealtimeTask } from '../runtime/moabomShellRealtimeRequestCoalescer';
import { resolveGeneratedLibraryScopeKey } from '../apps/generatedAppLibraryAuthority';

function toSettingsSnapshot(state: MoabomSystemState): Record<string, unknown> {
  return {
    layout: state.layout,
    appearance: state.appearance,
    preferences: state.preferences,
  } as Record<string, unknown>;
}

/**
 * 저장 직후 보호 정책:
 * - 로그인 사용자이면서 저장 큐 쿨다운 구간이면 서버 `settings` 대신 로컬 스냅샷 사용
 * - 게스트는 저장 큐의 영향을 받지 않음
 */
export function shouldUseLocalSettingsSnapshotForPull(input: {
  isLoggedIn: boolean;
  recentlySaved: boolean;
}): boolean {
  return input.isLoggedIn && input.recentlySaved;
}

export function resolveEffectiveSettingsForPull(input: {
  isLoggedIn: boolean;
  recentlySaved: boolean;
  localState: MoabomSystemState;
  serverSettings: Record<string, unknown> | undefined;
}): Record<string, unknown> | undefined {
  if (shouldUseLocalSettingsSnapshotForPull(input)) {
    return toSettingsSnapshot(input.localState);
  }
  return input.serverSettings;
}

/**
 * 관리자 플랫폼 설정·(로그인 시) 사용자 저장값을 서버에서 가져와 MoabomSystemState 로 병합합니다.
 * 게스트는 공개 `public/frontend-defaults`만 사용합니다.
 *
 * **저장 직후 pull 경합 방지**: 사용자가 마이페이지에서 빠르게 테마를 전환하면
 * `visibilitychange`/`focus`/주기 pull 이 서버의 아직 반영되지 않은 구버전 `settings` 를
 * 로컬 appearance·preferences 에 덮어쓸 수 있다. `moabomSettingsSaveQueue` 의 저장 쿨다운
 * 구간 안에서는 서버 `settings` 대신 **로컬 값을 사용자 의사로 간주하여 유지**하고,
 * `defaults`(플랫폼 팔레트·테마 목록·배경 목록 등)만 반영한다.
 */
export async function pullMoabomServerState(input: {
  isLoggedIn: boolean;
  memberKey?: string | null;
  coreUserLanguage?: string | null;
  preserveShellPanelOpen: boolean;
}): Promise<{ state: MoabomSystemState; defaults: MoabomSystemDefaults | null; mainAppOrder: MainAppOrderSnapshot } | null> {
  const coalesceKey = input.isLoggedIn
    ? `shell:pull-server-state:auth:${input.memberKey ?? 'pending'}:${input.coreUserLanguage ?? ''}`
    : 'shell:pull-server-state:guest';

  return runMoabomShellRealtimeTask(
    coalesceKey,
    () => pullMoabomServerStateUncoalesced(input),
    { minIntervalMs: 2_000 },
  );
}

async function pullMoabomServerStateUncoalesced(input: {
  isLoggedIn: boolean;
  memberKey?: string | null;
  coreUserLanguage?: string | null;
  preserveShellPanelOpen: boolean;
}): Promise<{ state: MoabomSystemState; defaults: MoabomSystemDefaults | null; mainAppOrder: MainAppOrderSnapshot } | null> {
  if (input.isLoggedIn && !input.memberKey) {
    return null;
  }

  const storageScopeKey = resolveGeneratedLibraryScopeKey(input.isLoggedIn, input.memberKey);
  const payload = await loadMoabomSettingsPayloadForMerge(input.isLoggedIn);
  if (!payload) {
    return null;
  }
  if (!input.isLoggedIn && !payload.defaults) {
    return null;
  }

  // 신규 방문자 판정은 첫 save() 이전에 해야 한다 (pull 내부에서 merged 저장 후엔 항상 false).
  const freshVisitor = !hasStoredMoabomSystemState();
  const localState = loadMoabomSystemState();

  const effectiveSettings = resolveEffectiveSettingsForPull({
    isLoggedIn: input.isLoggedIn,
    recentlySaved: isRecentlySavedSettings(),
    localState,
    serverSettings: payload.settings,
  });

  const serverRev = payload.defaults_revision ?? 0;
  const {
    state: merged,
    languageAlignmentPayloadForServer,
  } = mergeMoabomSystemStateFromSettingsApi(localState, { ...payload, settings: effectiveSettings }, {
    coreUserLanguage: input.coreUserLanguage ?? undefined,
    preserveShellPanelOpen: input.preserveShellPanelOpen,
    freshVisitor,
  });

  if (input.isLoggedIn && languageAlignmentPayloadForServer) {
    void queueSaveMoabomSystemSettings(merged);
  }

  if (!areMoabomSystemStatesEqual(localState, merged)) {
    saveMoabomSystemState(merged);
  }

  const localMainAppOrder = loadLocalMainAppOrder(storageScopeKey);
  const localMainAppOrderCustomized = hasLocalMainAppOrderCustomized(storageScopeKey);
  const serverMainAppOrder = extractServerMainAppOrder(payload.settings);
  const serverMainAppOrderCustomized = extractServerMainAppOrderCustomized(payload.settings);
  const trustLocalShellOrder = isRecentlySavedSettings()
    || isShellHomeDirty()
    || isRecentlySavedRecentAppIds();
  const mergedMainAppOrder = mergeMainAppOrderFromPull({
    isLoggedIn: input.isLoggedIn,
    trustLocalDuringCooldown: trustLocalShellOrder,
    localOrder: localMainAppOrder,
    localCustomized: localMainAppOrderCustomized,
    serverOrder: serverMainAppOrder,
    serverCustomized: serverMainAppOrderCustomized,
  });

  const localUnpinned = [...loadMainUnpinnedGeneratedIds(storageScopeKey)];
  const serverUnpinned = extractServerMainUnpinnedGeneratedIds(payload.settings);
  const mergedUnpinned = mergeMainUnpinnedFromPull({
    isLoggedIn: input.isLoggedIn,
    trustLocalDuringCooldown: trustLocalShellOrder,
    localUnpinned,
    serverUnpinned,
  });
  saveMainUnpinnedGeneratedIds(mergedUnpinned, storageScopeKey);

  const orderAfterUnpinned: MainAppOrderSnapshot = {
    ...mergedMainAppOrder,
    order: filterOrderExcludingUnpinned(mergedMainAppOrder.order, new Set(mergedUnpinned)),
  };

  if (
    orderAfterUnpinned.order.join('\0') !== localMainAppOrder.join('\0')
    || orderAfterUnpinned.customized !== localMainAppOrderCustomized
  ) {
    if (orderAfterUnpinned.customized) {
      saveLocalMainAppOrder(orderAfterUnpinned.order, storageScopeKey);
    } else {
      clearLocalMainAppOrder(storageScopeKey);
    }
  }

  const localAheadOfServer = localMainAppOrderCustomized
    && serverMainAppOrder !== null
    && isLocalMainOrderAheadOfServer(localMainAppOrder, serverMainAppOrder);

  if (
    input.isLoggedIn
    && !trustLocalShellOrder
    && (
      (
        serverMainAppOrderCustomized !== true
        && serverMainAppOrder === null
        && localMainAppOrderCustomized
      )
      || (serverUnpinned === null && mergedUnpinned.length > 0)
      || localAheadOfServer
    )
  ) {
    void queueSaveShellHomeSettings({
      order: orderAfterUnpinned.customized ? orderAfterUnpinned.order : localMainAppOrder,
      customized: orderAfterUnpinned.customized || localMainAppOrderCustomized,
      unpinnedGeneratedIds: mergedUnpinned,
    }, true);
  }

  const localRecentAppIds = loadJsonSanitizedIds(STORAGE_KEY_RECENT_APPS, []).slice(0, 10);
  const serverRecentAppIds = extractServerRecentAppIds(payload.settings);
  const mergedRecentAppIds = mergeRecentAppIdsFromPull({
    isLoggedIn: input.isLoggedIn,
    trustLocalDuringCooldown: trustLocalShellOrder,
    localIds: localRecentAppIds,
    serverIds: serverRecentAppIds,
  });

  if (mergedRecentAppIds.join('\0') !== localRecentAppIds.join('\0')) {
    saveJson(STORAGE_KEY_RECENT_APPS, mergedRecentAppIds);
  }

  if (
    input.isLoggedIn
    && !trustLocalShellOrder
    && serverRecentAppIds === null
    && mergedRecentAppIds.length > 0
  ) {
    queueSaveRecentAppIds(mergedRecentAppIds, true);
  }

  writeStoredMoabomDefaultsRevision(serverRev);
  applyMoabomSystemAppearance(merged.appearance);

  return {
    state: merged,
    defaults: payload.defaults ?? null,
    mainAppOrder: orderAfterUnpinned,
  };
}
