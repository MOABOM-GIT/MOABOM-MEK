import type { MoabomSystemDefaults, MoabomSystemState } from '../types/moabomSystem';
import { alignMoabomPreferenceWithCoreProfile } from './moabomLanguageSync';
import { deriveMoabomBackgroundImageChoicesFromAppearance } from './moBackgroundAssets';
import { defaultsToSystemState, normalizeMoabomSystemState } from './moabomSystemStore';

/** 관리자 플랫폼 설정 저장 rev — 로컬과 비교해 재기준화 여부 판단 */
export const MOABOM_DEFAULTS_REVISION_STORAGE_KEY = 'moabom_system_defaults_revision';

export function writeStoredMoabomDefaultsRevision(rev: number): void {
  try {
    localStorage.setItem(MOABOM_DEFAULTS_REVISION_STORAGE_KEY, String(rev));
  } catch {
    /* ignore quota */
  }
}

export interface MoabomSettingsApiPayload {
  defaults?: MoabomSystemDefaults;
  settings?: Record<string, unknown>;
  /** 서버 `defaults_revision` (미포함 시 0) */
  defaults_revision?: number;
}

export interface MergeMoabomFromApiOptions {
  coreUserLanguage?: string | null;
  /** 홈 셸: 좌·우 패널 개폐는 로컬 값 유지 */
  preserveShellPanelOpen: boolean;
  /**
   * 신규 방문자(localStorage 에 저장된 상태가 아직 없음) 여부.
   * true 면 비저장 세션에서 글자 크기를 관리자 기본값(defaults.appearance.font_size_default)으로 시드한다.
   * 한 번 저장된 뒤(false)에는 사용자 로컬 값을 보존한다(테마·포인트와 동일 정책).
   */
  freshVisitor?: boolean;
}

export interface MergeMoabomFromApiResult {
  state: MoabomSystemState;
  /**
   * 게스트에 가깝게 아직 저장된 설정이 없을 때, 코어 프로필 언어에 맞춘 뒤
   * 서버 UserSystemSetting 에 반영(기존 마이페이지와 동일 타이밍: 배경 클램프 전 상태).
   */
  languageAlignmentPayloadForServer?: MoabomSystemState;
}

/**
 * GET /api/modules/moabom-system/user/settings 의 defaults/settings 를
 * 로컬 `MoabomSystemState` 와 같은 규칙으로 병합합니다.
 *
 * **저장된 사용자 설정**(`settings` 비어 있지 않음)이 있으면 `defaults_revision` 이 올라도
 * 테마·포인트·언어·시스템 옵션을 플랫폼 기본값으로 덮지 않습니다(마이페이지 선택 유지).
 * 비저장·게스트에 가까운 경우에도 appearance 는 로컬 값을 유지합니다.
 * 관리자 `themes`·`point_color_presets`·`background_*` 값은 마이페이지 선택 후보로만 쓰며,
 * 관리자 저장만으로 현재 홈페이지 테마·포인트·배경을 바꾸지 않습니다.
 */
export function mergeMoabomSystemStateFromSettingsApi(
  localState: MoabomSystemState,
  payload: MoabomSettingsApiPayload,
  options: MergeMoabomFromApiOptions,
): MergeMoabomFromApiResult {
  const defaultState = defaultsToSystemState(payload.defaults);
  const rawSettings = payload.settings;
  const hasPersistedSettings =
    !!rawSettings && typeof rawSettings === 'object' && Object.keys(rawSettings).length > 0;

  let mergedState: MoabomSystemState;
  /*
   * 신규 방문자는 관리자 기본 글자 크기를 적용하고, 재방문/기존 사용자는 로컬 선택을 보존한다.
   * (테마·포인트·배경은 기존대로 항상 로컬 보존)
   */
  const appearanceForNonPersisted: MoabomSystemState['appearance'] = options.freshVisitor
    ? { ...localState.appearance, fontSize: defaultState.appearance.fontSize }
    : localState.appearance;
  const mergeWithoutPersistedAppearance = () => normalizeMoabomSystemState(
    {
      ...defaultState,
      layout: localState.layout,
      appearance: appearanceForNonPersisted,
      preferences: {
        ...defaultState.preferences,
        /*
         * 최초 방문의 브라우저 언어 반영은 loadMoabomSystemState()가 localState 생성 시 한 번만 담당한다.
         * 이후 서버 defaults pull은 저장 settings가 없더라도 사용자가 이미 고른 로컬 언어를 덮지 않는다.
         * 그렇지 않으면 마이페이지 settings를 여는 순간 public defaults 병합이 브라우저 언어(예: ko)로 되돌린다.
         */
        language: localState.preferences.language,
        /*
         * Req 1.4 / 1.4a — 비로그인·미저장 세션에서는 사용자가 마이페이지 토글로 바꾼
         * `systemOptions` 를 서버 pull 로 덮어쓰지 않는다. 관리자 `on_by_default` 변경은
         * 해당 id 의 로컬 raw 값이 부재할 때만 `computeEffectiveSystemOptions` baseline 에
         * 반영되므로(런타임 해석 단계), merge 레이어에서는 로컬 raw 를 그대로 보존한다.
         * 관리자 잠금(`user_editable === false`) 은 effective 해석 단계에서 강제되므로
         * 본 변경이 Req 1.1 / 1.6 을 훼손하지 않는다.
         */
        systemOptions: localState.preferences.systemOptions,
      },
    },
    defaultState,
  );

  if (hasPersistedSettings) {
    mergedState = normalizeMoabomSystemState(rawSettings, defaultState);
  } else {
    mergedState = mergeWithoutPersistedAppearance();
  }

  let languageAlignmentPayloadForServer: MoabomSystemState | undefined;

  const shouldAlignLanguage = !hasPersistedSettings;
  if (shouldAlignLanguage) {
    const alignedLanguage = alignMoabomPreferenceWithCoreProfile(
      mergedState.preferences.language,
      options.coreUserLanguage ?? undefined,
    );

    if (alignedLanguage !== mergedState.preferences.language) {
      mergedState = {
        ...mergedState,
        preferences: {
          ...mergedState.preferences,
          language: alignedLanguage,
        },
      };
      languageAlignmentPayloadForServer = mergedState;
    }
  }

  // 관리자 업로드 배경 목록과 합쳐 홈 셸 기본 배경을 결정한다.
  // - 현재 backgroundImageId 가 비어 있거나(첫 방문자/게스트·신규 사용자) 목록에 없으면(관리자가 삭제) 첫 항목으로 보정
  // - 목록 자체가 비어 있으면 빈 문자열을 유지하여 셸이 기본 배경색을 쓰게 한다.
  const bgChoices = deriveMoabomBackgroundImageChoicesFromAppearance(payload.defaults?.appearance);
  if (bgChoices.length > 0) {
    const current = mergedState.appearance.backgroundImageId;
    if (!current || !bgChoices.includes(current)) {
      mergedState = {
        ...mergedState,
        appearance: {
          ...mergedState.appearance,
          backgroundImageId: bgChoices[0],
        },
      };
    }
  } else if (mergedState.appearance.backgroundImageId) {
    // 업로드 배경이 모두 삭제된 경우: 현재 선택값도 무효화
    mergedState = {
      ...mergedState,
      appearance: {
        ...mergedState.appearance,
        backgroundImageId: '',
      },
    };
  }

  if (options.preserveShellPanelOpen) {
    mergedState = {
      ...mergedState,
      layout: {
        ...mergedState.layout,
        leftPanelOpen: localState.layout.leftPanelOpen,
        rightPanelOpen: localState.layout.rightPanelOpen,
      },
    };
  }

  return {
    state: mergedState,
    languageAlignmentPayloadForServer,
  };
}
