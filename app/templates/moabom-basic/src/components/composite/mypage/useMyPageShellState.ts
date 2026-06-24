import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { updateCoreUserLanguage } from '../../../api/moabomSystemApi';
import type { MoabomSystemDefaults, MoabomSystemState } from '../../../types/moabomSystem';
import {
  DEFAULT_MOABOM_SYSTEM,
  MOABOM_SYSTEM_STATE_CHANGED_EVENT,
  applyMoabomSystemAppearance,
  defaultsToSystemState,
  loadMoabomSystemState,
  mergeMoabomSystemState,
  normalizeMoabomSystemState,
  saveMoabomSystemState,
} from '../../../utils/moabomSystemStore';
import { pullMoabomServerState } from '../../../utils/moabomPullServerState';
import {
  coreSyncLanguageFromMoabomPref,
  isMoabomSystemStateLanguageOnlyChange,
} from '../../../utils/moabomLanguageSync';
import { areMoabomSystemStatesEqual } from '../../../utils/moabomSystemStore';
import { queueSaveMoabomSystemSettings } from '../../../utils/moabomSettingsSaveQueue';
import { markMoabomUiLanguageDirty } from '../../../i18n/moabomSyncG7Locale';
import {
  clampMoabomBackgroundImageId,
  deriveMoabomBackgroundImageChoicesByMode,
  deriveMoabomBackgroundImageChoicesFromAppearance,
  moabomThemeToBackgroundMode,
} from '../../../utils/moBackgroundAssets';
import { useMoabomServerPullTriggers } from '../../../utils/useMoabomServerPullTriggers';
import type { AuthManagerUserSnapshot, MyPageUser } from './myPageTypes';

const MY_PAGE_SERVER_PULL_DEBOUNCE_MS = 180;

export interface MyPageShellSystemBinding {
  systemState: MoabomSystemState;
  systemDefaults: MoabomSystemDefaults | null;
  setSystemState: Dispatch<SetStateAction<MoabomSystemState>>;
  setSystemDefaults: Dispatch<SetStateAction<MoabomSystemDefaults | null>>;
}

interface UseMyPageShellStateOptions {
  currentUser: MyPageUser | null;
  onProfileUpdated?: (user?: AuthManagerUserSnapshot | null) => void;
  /** 홈 셸과 상태를 공유할 때 전달 — 중복 server pull 생략 */
  shellSystem?: MyPageShellSystemBinding;
}

export function useMyPageShellState({
  currentUser,
  onProfileUpdated,
  shellSystem,
}: UseMyPageShellStateOptions) {
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const [localSystemDefaults, setLocalSystemDefaults] = useState<MoabomSystemDefaults | null>(null);
  const [localSystemState, setLocalSystemState] = useState<MoabomSystemState>(() => loadMoabomSystemState());

  const usesShellSystem = Boolean(shellSystem);
  const systemDefaults = shellSystem?.systemDefaults ?? localSystemDefaults;
  const systemState = shellSystem?.systemState ?? localSystemState;
  const setSystemDefaults = shellSystem?.setSystemDefaults ?? setLocalSystemDefaults;
  const setSystemState = shellSystem?.setSystemState ?? setLocalSystemState;

  const pullMyPageServerSnapshot = useCallback(async () => {
    const user = currentUserRef.current;
    const loggedIn = Boolean(user);
    if (loggedIn && !user?.memberKey) return null;
    return pullMoabomServerState({
      isLoggedIn: loggedIn,
      coreUserLanguage: user?.language ?? undefined,
      preserveShellPanelOpen: true,
    });
  }, []);

  useEffect(() => {
    if (usesShellSystem) {
      return;
    }

    let cancelled = false;

    if (currentUser && !currentUser.memberKey) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const pulled = await pullMyPageServerSnapshot();
      if (cancelled || !pulled) return;
      setLocalSystemDefaults(pulled.defaults);
      setLocalSystemState(pulled.state);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.memberKey, pullMyPageServerSnapshot, usesShellSystem]);

  useEffect(() => {
    if (usesShellSystem || typeof window === 'undefined') {
      return;
    }
    const syncStateFromPersistence = () => {
      const disk = loadMoabomSystemState();
      setLocalSystemState(prev => {
        const merged = mergeMoabomSystemState(prev, {
          layout: disk.layout,
          appearance: disk.appearance,
          preferences: disk.preferences,
        });
        return areMoabomSystemStatesEqual(prev, merged) ? prev : merged;
      });
    };
    window.addEventListener(MOABOM_SYSTEM_STATE_CHANGED_EVENT, syncStateFromPersistence);
    return () => window.removeEventListener(MOABOM_SYSTEM_STATE_CHANGED_EVENT, syncStateFromPersistence);
  }, [usesShellSystem]);

  useMoabomServerPullTriggers(
    async () => {
      if (usesShellSystem) {
        return;
      }
      const pulled = await pullMyPageServerSnapshot();
      if (pulled) {
        setLocalSystemDefaults(pulled.defaults);
        setLocalSystemState(pulled.state);
      }
    },
    {
      debounceMs: MY_PAGE_SERVER_PULL_DEBOUNCE_MS,
      onFocus: true,
      onVisible: true,
      enabled: !usesShellSystem,
    },
  );

  const handleSystemStateChange = useCallback((nextRaw: MoabomSystemState) => {
    const themeChanged = nextRaw.appearance.theme !== systemState.appearance.theme;
    const backgroundChanged =
      nextRaw.appearance.backgroundImageId !== systemState.appearance.backgroundImageId;

    let workingAppearance = { ...nextRaw.appearance };

    if (themeChanged && !backgroundChanged) {
      const nextMode = moabomThemeToBackgroundMode(nextRaw.appearance.theme);
      const modeList = deriveMoabomBackgroundImageChoicesByMode(
        systemDefaults?.appearance,
        nextMode,
      );
      if (modeList.length > 0 && !modeList.includes(workingAppearance.backgroundImageId)) {
        workingAppearance = {
          ...workingAppearance,
          backgroundImageId: modeList[0] ?? workingAppearance.backgroundImageId,
        };
      }
    }

    const bgAllow = deriveMoabomBackgroundImageChoicesFromAppearance(systemDefaults?.appearance);
    const effectiveBackgroundChanged =
      workingAppearance.backgroundImageId !== systemState.appearance.backgroundImageId;
    const persistedLayout = loadMoabomSystemState().layout;
    const nextClamped: MoabomSystemState = {
      ...nextRaw,
      layout: persistedLayout,
      appearance: {
        ...workingAppearance,
        backgroundImageId: effectiveBackgroundChanged
          ? clampMoabomBackgroundImageId(workingAppearance.backgroundImageId, bgAllow)
          : workingAppearance.backgroundImageId,
      },
    };
    const next = normalizeMoabomSystemState(
      nextClamped,
      defaultsToSystemState(systemDefaults ?? undefined),
    );
    const prevSnapshot = systemState;

    const languageOnlyWhileLoggedIn =
      !!currentUser && isMoabomSystemStateLanguageOnlyChange(prevSnapshot, next);

    if (prevSnapshot.preferences.language !== next.preferences.language) {
      markMoabomUiLanguageDirty();
      if (currentUser) {
        const syncLang = coreSyncLanguageFromMoabomPref(next.preferences.language);
        onProfileUpdated?.({ ...currentUser, language: syncLang });
      }
    }

    setSystemState(next);
    saveMoabomSystemState(next);
    applyMoabomSystemAppearance(next.appearance);

    if (!currentUser) {
      return;
    }

    void (async () => {
      await queueSaveMoabomSystemSettings(next);
      const syncLang = coreSyncLanguageFromMoabomPref(next.preferences.language);
      const { ok } = await updateCoreUserLanguage(syncLang);
      if (!ok) {
        return;
      }
      const G7Core = (window as any).G7Core;
      const auth = G7Core?.AuthManager?.getInstance?.();

      if (languageOnlyWhileLoggedIn) {
        const u = auth?.getUser?.();
        if (u) {
          onProfileUpdated?.({ ...u, language: syncLang });
        }
        return;
      }

      if (typeof auth?.checkAuth === 'function') {
        await auth.checkAuth('user');
      }
      const refreshed = auth?.getUser?.();
      onProfileUpdated?.(refreshed ?? undefined);
    })();
  }, [currentUser, onProfileUpdated, setSystemState, systemDefaults, systemState]);

  return {
    systemDefaults,
    systemState,
    handleSystemStateChange,
  };
}

export { DEFAULT_MOABOM_SYSTEM };
