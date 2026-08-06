import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MoabomSystemState } from '../types/moabomSystem';
import { DEFAULT_MOABOM_SYSTEM, MOABOM_SYSTEM_STORAGE_KEY } from './moabomSystemStore';

// API 모킹
vi.mock('../api/moabomSystemApi', () => ({
  loadMoabomSettingsPayloadForMerge: vi.fn(),
  saveMoabomSystemSettings: vi.fn().mockResolvedValue({ ok: true }),
}));

import { loadMoabomSettingsPayloadForMerge } from '../api/moabomSystemApi';
import {
  pullMoabomServerState,
  resolveEffectiveSettingsForPull,
  shouldUseLocalSettingsSnapshotForPull,
} from './moabomPullServerState';
import {
  __resetMoabomSettingsSaveQueueForTest,
  queueSaveMoabomSystemSettings,
} from './moabomSettingsSaveQueue';
import { __resetMoabomShellOrderSaveQueueForTest } from './moabomShellOrderSaveQueue';
import { saveLocalMainAppOrder } from '../shell/moaShellAppOrder';
import {
  addMainUnpinnedGeneratedId,
  setActiveMainUnpinnedScopeKey,
} from '../shell/moaShellMainAppUnpinned';

const LOCAL_STATE: MoabomSystemState = {
  ...DEFAULT_MOABOM_SYSTEM,
  appearance: { theme: 'flat-dark', pointColor: '#ff0088', backgroundImageId: '', fontSize: 3 },
  preferences: {
    ...DEFAULT_MOABOM_SYSTEM.preferences,
    language: 'ko',
  },
};

const STALE_SERVER_STATE: Partial<MoabomSystemState> = {
  appearance: { theme: 'light', pointColor: '#6366f1', backgroundImageId: '', fontSize: 3 },
  preferences: { language: 'en', systemOptions: DEFAULT_MOABOM_SYSTEM.preferences.systemOptions },
};

describe('pull settings guard policy', () => {
  it('로그인 + 최근 저장이면 로컬 스냅샷 사용', () => {
    expect(
      shouldUseLocalSettingsSnapshotForPull({ isLoggedIn: true, recentlySaved: true }),
    ).toBe(true);
  });

  it('게스트는 최근 저장이어도 서버 settings 유지', () => {
    expect(
      shouldUseLocalSettingsSnapshotForPull({ isLoggedIn: false, recentlySaved: true }),
    ).toBe(false);
  });

  it('resolveEffectiveSettingsForPull은 정책에 따라 소스를 선택한다', () => {
    const selected = resolveEffectiveSettingsForPull({
      isLoggedIn: true,
      recentlySaved: true,
      localState: LOCAL_STATE,
      serverSettings: STALE_SERVER_STATE as Record<string, unknown>,
    });
    expect((selected as { appearance?: { theme?: string } }).appearance?.theme).toBe('flat-dark');
  });

  it('resolveEffectiveSettingsForPull은 게스트에서 서버 settings를 유지한다', () => {
    const selected = resolveEffectiveSettingsForPull({
      isLoggedIn: false,
      recentlySaved: true,
      localState: LOCAL_STATE,
      serverSettings: STALE_SERVER_STATE as Record<string, unknown>,
    });
    expect((selected as { appearance?: { theme?: string } }).appearance?.theme).toBe('light');
  });
});

describe('pullMoabomServerState — 저장 직후 구버전 settings 덮어쓰기 방지', () => {
  beforeEach(() => {
    __resetMoabomSettingsSaveQueueForTest();
    __resetMoabomShellOrderSaveQueueForTest();
    vi.mocked(loadMoabomSettingsPayloadForMerge).mockReset();
    localStorage.clear();
    localStorage.setItem(MOABOM_SYSTEM_STORAGE_KEY, JSON.stringify(LOCAL_STATE));
    setActiveMainUnpinnedScopeKey('guest');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('저장 쿨다운 구간에는 서버 settings 를 로컬 appearance·preferences 에 반영하지 않는다', async () => {
    // 저장 큐에 in-flight 요청을 걸어 "저장 중" 상태를 만든다
    // saveMoabomSystemSettings 를 resolved 상태로 호출하면 쿨다운이 즉시 시작됨
    await queueSaveMoabomSystemSettings(LOCAL_STATE);

    // 서버는 구버전 settings(STALE) 와 defaults 를 반환
    vi.mocked(loadMoabomSettingsPayloadForMerge).mockResolvedValue({
      defaults: {
        appearance: {
          themes: [
            { id: 'light' as const, label: 'Light', enabled: true },
            { id: 'flat-dark' as const, label: 'Flat Dark', enabled: true },
          ],
          point_color_presets: ['#6366f1'],
          home_background_items: [],
        },
      },
      settings: STALE_SERVER_STATE as Record<string, unknown>,
      defaults_revision: 1,
    });

    const result = await pullMoabomServerState({
      isLoggedIn: true,
      memberKey: 'test-member',
      coreUserLanguage: 'ko',
      preserveShellPanelOpen: true,
    });

    expect(result).not.toBeNull();
    // 로컬 appearance·preferences 가 보존되어야 함
    expect(result!.state.appearance.theme).toBe('flat-dark');
    expect(result!.state.appearance.pointColor).toBe('#ff0088');
    expect(result!.state.preferences.language).toBe('ko');
    // defaults 는 정상적으로 전달됨
    expect(result!.defaults).not.toBeNull();
    expect(result!.defaults?.appearance?.themes).toHaveLength(2);
  });

  it('저장 쿨다운이 끝난 뒤에는 서버 settings 가 정상 반영된다', async () => {
    // 쿨다운을 수동으로 건너뛰기 위해 큐를 리셋 (실제 앱에서는 시간 경과)
    __resetMoabomSettingsSaveQueueForTest();

    vi.mocked(loadMoabomSettingsPayloadForMerge).mockResolvedValue({
      defaults: {
        appearance: {
          themes: [{ id: 'light' as const, label: 'Light', enabled: true }],
          point_color_presets: ['#6366f1'],
          home_background_items: [],
        },
      },
      settings: STALE_SERVER_STATE as Record<string, unknown>,
      defaults_revision: 1,
    });

    const result = await pullMoabomServerState({
      isLoggedIn: true,
      memberKey: 'test-member',
      coreUserLanguage: 'ko',
      preserveShellPanelOpen: true,
    });

    expect(result).not.toBeNull();
    // 쿨다운이 없으므로 서버 값이 반영됨
    expect(result!.state.appearance.theme).toBe('light');
    expect(result!.state.appearance.pointColor).toBe('#6366f1');
  });

  it('비로그인(게스트) 경로는 저장 큐 영향을 받지 않고 그대로 defaults 를 반영한다', async () => {
    // 로그인 사용자용 쿨다운이 있어도 게스트는 영향 없음
    await queueSaveMoabomSystemSettings(LOCAL_STATE);

    vi.mocked(loadMoabomSettingsPayloadForMerge).mockResolvedValue({
      defaults: {
        appearance: {
          themes: [{ id: 'light' as const, label: 'Light', enabled: true }],
          point_color_presets: ['#000000'],
          home_background_items: [],
        },
      },
      settings: {},
      defaults_revision: 1,
    });

    const result = await pullMoabomServerState({
      isLoggedIn: false,
      preserveShellPanelOpen: true,
    });

    expect(result).not.toBeNull();
    // 게스트는 로컬 appearance 유지 (저장된 사용자 설정이 없으므로)
    expect(result!.state.appearance.theme).toBe('flat-dark');
  });

  it('서버 mainAppOrder 가 stale 이어도 로컬 unpinned 로 생성 앱을 메인에서 숨긴다', async () => {
    __resetMoabomSettingsSaveQueueForTest();
    __resetMoabomShellOrderSaveQueueForTest();

    saveLocalMainAppOrder(['hospital-info'], 'member:test-member');
    addMainUnpinnedGeneratedId('generated-app-7', 'member:test-member');

    vi.mocked(loadMoabomSettingsPayloadForMerge).mockResolvedValue({
      defaults: {
        appearance: {
          themes: [{ id: 'light' as const, label: 'Light', enabled: true }],
          point_color_presets: ['#6366f1'],
          home_background_items: [],
        },
      },
      settings: {
        shell: {
          home: {
            mainAppOrder: ['hospital-info', 'generated-app-7'],
            mainAppOrderCustomized: true,
          },
        },
      },
      defaults_revision: 1,
    });

    const result = await pullMoabomServerState({
      isLoggedIn: true,
      memberKey: 'test-member',
      coreUserLanguage: 'ko',
      preserveShellPanelOpen: true,
    });

    expect(result).not.toBeNull();
    expect(result!.mainAppOrder.order).toEqual(['hospital-info']);
    expect(result!.mainAppOrder.customized).toBe(true);
  });
});
