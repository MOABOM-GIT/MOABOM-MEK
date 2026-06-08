import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MoabomSystemState } from '../types/moabomSystem';
import { mergeMoabomSystemStateFromSettingsApi } from './moabomSystemServerMerge';
import { DEFAULT_MOABOM_SYSTEM } from './moabomSystemStore';

const LOCAL_BG_UUID = '550e8400-e29b-41d4-a716-446655440000';
const PLATFORM_BG_UUID = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const SECOND_PLATFORM_UUID = '00000000-0000-4000-8000-000000000001';

const baseOptions = {
  preserveShellPanelOpen: true,
};

const platformListAppearance = {
  themes: [
    { id: 'dark' as const, label: '다크', enabled: true },
    { id: 'light' as const, label: '라이트', enabled: true },
  ],
  point_color_presets: ['#ff0000', '#6366f1'],
  home_background_items: [{ id: PLATFORM_BG_UUID }, { id: SECOND_PLATFORM_UUID }],
};

describe('mergeMoabomSystemStateFromSettingsApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const local: MoabomSystemState = {
    ...DEFAULT_MOABOM_SYSTEM,
    layout: { ...DEFAULT_MOABOM_SYSTEM.layout, leftPanelOpen: false, rightPanelOpen: true },
    appearance: { theme: 'flat-light', pointColor: '#112233', backgroundImageId: LOCAL_BG_UUID, fontSize: 3 },
    preferences: {
      language: 'zh',
      systemOptions: {
        sound: false,
        animation: false,
        haptic: true,
        toast: false,
        weather: false,
      },
    },
  };

  it('관리자 업로드 목록에 없는 로컬 배경은 첫 번째 업로드 배경으로 자동 보정된다', () => {
    const { state } = mergeMoabomSystemStateFromSettingsApi(
      local,
      {
        defaults: {
          appearance: platformListAppearance,
        },
        settings: {},
      },
      baseOptions,
    );

    // 테마·포인트·언어·패널은 로컬 유지
    expect(state.appearance.theme).toBe('flat-light');
    expect(state.appearance.pointColor).toBe('#112233');
    expect(state.layout.leftPanelOpen).toBe(false);
    expect(state.layout.rightPanelOpen).toBe(true);
    // Req 1.4 / 1.4a — 비저장 세션에서 systemOptions 는 로컬 raw 값을 그대로 유지한다.
    // 관리자 on_by_default 는 런타임 effective 해석 단계(computeEffectiveSystemOptions) 가 담당한다.
    expect(state.preferences.systemOptions).toEqual(local.preferences.systemOptions);
    // 배경은 관리자 목록 첫 번째 항목으로 보정(로컬 LOCAL_BG_UUID 는 목록에 없음)
    expect(state.appearance.backgroundImageId).toBe(PLATFORM_BG_UUID);
  });

  it('게스트 병합 시도 같은 규칙을 적용한다(첫 업로드 배경)', () => {
    const { state } = mergeMoabomSystemStateFromSettingsApi(
      local,
      {
        defaults: {
          appearance: platformListAppearance,
        },
        settings: {},
      },
      baseOptions,
    );

    expect(state.appearance.theme).toBe('flat-light');
    expect(state.appearance.pointColor).toBe('#112233');
    expect(state.appearance.backgroundImageId).toBe(PLATFORM_BG_UUID);
  });

  it('로컬 배경이 관리자 목록에 있으면 그대로 유지된다', () => {
    const localWithPlatformBg: MoabomSystemState = {
      ...local,
      appearance: { ...local.appearance, backgroundImageId: SECOND_PLATFORM_UUID },
    };

    const { state } = mergeMoabomSystemStateFromSettingsApi(
      localWithPlatformBg,
      {
        defaults: {
          appearance: platformListAppearance,
        },
        settings: {},
      },
      baseOptions,
    );

    expect(state.appearance.backgroundImageId).toBe(SECOND_PLATFORM_UUID);
  });

  it('업로드 배경이 전혀 없으면 배경 선택은 빈 문자열(기본 배경색) 상태로 초기화된다', () => {
    const { state } = mergeMoabomSystemStateFromSettingsApi(
      local,
      {
        defaults: {
          appearance: { themes: [], point_color_presets: [], home_background_items: [] },
        },
        settings: {},
      },
      baseOptions,
    );

    expect(state.appearance.backgroundImageId).toBe('');
  });

  it('비저장 사용자의 systemOptions 는 관리자 기본값으로 덮이지 않고 로컬 raw 값을 유지한다 (Req 1.4 / 1.4a)', () => {
    const { state } = mergeMoabomSystemStateFromSettingsApi(
      local,
      {
        defaults: {
          preferences: {
            system_options: [
              { id: 'sound', label: '사운드', on_by_default: true, user_editable: true },
              { id: 'animation', label: '애니메이션', on_by_default: true, user_editable: true },
              { id: 'haptic', label: '햅틱', on_by_default: false, user_editable: true },
              { id: 'toast', label: '토스트', on_by_default: true, user_editable: true },
              { id: 'weather', label: '날씨', on_by_default: true, user_editable: true },
            ],
          },
        },
        settings: {},
      },
      { ...baseOptions, coreUserLanguage: 'ko' },
    );

    // merge 레이어는 로컬 raw 값을 그대로 유지한다. 관리자 on_by_default 는
    // 런타임 effective 해석 단계(computeEffectiveSystemOptions) 에서 baseline 으로 쓰이지만,
    // 해당 id 의 로컬 raw 값이 존재하면 사용자 값이 우선이다 (user_editable === true 전제).
    expect(state.preferences.systemOptions).toEqual(local.preferences.systemOptions);
  });

  it('게스트 언어는 최초 로드에서 결정된 로컬 선택을 서버 defaults pull 때도 유지한다', () => {
    vi.stubGlobal('navigator', { languages: ['ja-JP'], language: 'ja-JP' });

    const { state } = mergeMoabomSystemStateFromSettingsApi(
      local,
      {
        defaults: {
          preferences: {
            default_language: 'ko',
          },
        },
        settings: {},
      },
      baseOptions,
    );

    expect(state.preferences.language).toBe('zh');
  });

  it('이미 저장된 settings 의 배경이 관리자 목록 안에 있으면 그대로 유지된다', () => {
    const { state } = mergeMoabomSystemStateFromSettingsApi(
      local,
      {
        defaults: { appearance: platformListAppearance },
        settings: {
          appearance: { theme: 'flat-dark', pointColor: '#111111', backgroundImageId: SECOND_PLATFORM_UUID },
        },
      },
      { ...baseOptions, preserveShellPanelOpen: false },
    );

    expect(state.appearance.theme).toBe('flat-dark');
    expect(state.appearance.backgroundImageId).toBe(SECOND_PLATFORM_UUID);
  });

  it('저장된 settings 의 배경이 관리자 목록에서 빠졌으면 첫 항목으로 자동 보정된다', () => {
    const { state } = mergeMoabomSystemStateFromSettingsApi(
      local,
      {
        defaults: { appearance: platformListAppearance },
        settings: {
          appearance: { theme: 'flat-dark', pointColor: '#111111', backgroundImageId: LOCAL_BG_UUID },
        },
      },
      { ...baseOptions, preserveShellPanelOpen: false },
    );

    expect(state.appearance.backgroundImageId).toBe(PLATFORM_BG_UUID);
  });

  it('defaults_revision 상승해도 저장된 사용자 테마·포인트·언어는 플랫폼으로 덮지 않는다', () => {
    const { state } = mergeMoabomSystemStateFromSettingsApi(
      local,
      {
        defaults: {
          appearance: {
            point_color_presets: ['#6366f1', '#03a94d'],
            home_background_items: [{ id: PLATFORM_BG_UUID }],
          },
        },
        settings: {
          layout: { centerMode: 'sites' },
          appearance: { theme: 'flat-dark', pointColor: '#6366f1', backgroundImageId: PLATFORM_BG_UUID },
          preferences: { language: 'en' },
        },
        defaults_revision: 3,
      },
      baseOptions,
    );

    expect(state.appearance.theme).toBe('flat-dark');
    expect(state.appearance.pointColor).toBe('#6366f1');
    expect(state.appearance.backgroundImageId).toBe(PLATFORM_BG_UUID);
    expect(state.layout.centerMode).toBe('sites');
    expect(state.preferences.language).toBe('en');
  });

  it('관리자 프리셋에 없는 저장 포인트 색도 자동 보정하지 않는다', () => {
    const { state } = mergeMoabomSystemStateFromSettingsApi(
      local,
      {
        defaults: {
          appearance: {
            point_color_presets: ['#6366f1', '#03a94d'],
            home_background_items: [{ id: PLATFORM_BG_UUID }],
          },
        },
        settings: {
          appearance: { theme: 'dark', pointColor: '#999999', backgroundImageId: PLATFORM_BG_UUID },
        },
      },
      baseOptions,
    );

    expect(state.appearance.pointColor).toBe('#999999');
  });

  it('저장 이력 없고 rev 상승 시 로그인 경로도 로컬 테마·포인트는 유지하되 배경은 관리자 첫 항목으로 보정', () => {
    const { state } = mergeMoabomSystemStateFromSettingsApi(
      local,
      {
        defaults: {
          appearance: platformListAppearance,
        },
        settings: {},
        defaults_revision: 3,
      },
      baseOptions,
    );

    expect(state.appearance.theme).toBe('flat-light');
    expect(state.appearance.pointColor).toBe('#112233');
    expect(state.appearance.backgroundImageId).toBe(PLATFORM_BG_UUID);
  });

  it('저장 이력 없고 rev 상승 시 게스트 경로도 로컬 테마·포인트는 유지하되 배경은 관리자 첫 항목으로 보정', () => {
    const { state } = mergeMoabomSystemStateFromSettingsApi(
      local,
      {
        defaults: {
          appearance: platformListAppearance,
        },
        settings: {},
        defaults_revision: 3,
      },
      baseOptions,
    );

    expect(state.appearance.theme).toBe('flat-light');
    expect(state.appearance.pointColor).toBe('#112233');
    expect(state.appearance.backgroundImageId).toBe(PLATFORM_BG_UUID);
  });

  it('신규 방문자(freshVisitor)는 관리자 기본 글자 크기를 적용한다', () => {
    const { state } = mergeMoabomSystemStateFromSettingsApi(
      local,
      {
        defaults: { appearance: { font_size_default: 5 } },
        settings: {},
      },
      { ...baseOptions, freshVisitor: true },
    );

    expect(state.appearance.fontSize).toBe(5);
    // 테마·포인트는 여전히 로컬 보존
    expect(state.appearance.theme).toBe('flat-light');
    expect(state.appearance.pointColor).toBe('#112233');
  });

  it('재방문자(freshVisitor=false)는 로컬 글자 크기를 보존한다', () => {
    const localWithFont: MoabomSystemState = {
      ...local,
      appearance: { ...local.appearance, fontSize: 2 },
    };
    const { state } = mergeMoabomSystemStateFromSettingsApi(
      localWithFont,
      {
        defaults: { appearance: { font_size_default: 5 } },
        settings: {},
      },
      { ...baseOptions, freshVisitor: false },
    );

    expect(state.appearance.fontSize).toBe(2);
  });

  it('저장된 사용자 settings 의 글자 크기는 그대로 적용된다', () => {
    const { state } = mergeMoabomSystemStateFromSettingsApi(
      local,
      {
        defaults: { appearance: { font_size_default: 3 } },
        settings: {
          appearance: { theme: 'dark', pointColor: '#112233', backgroundImageId: '', fontSize: 4 },
        },
      },
      baseOptions,
    );

    expect(state.appearance.fontSize).toBe(4);
  });
});
