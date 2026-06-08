import React, { useEffect, useMemo, useState } from 'react';
import type { MoabomSystemLanguage } from '../types/moabomSystem';
import {
  MOABOM_SYSTEM_STATE_CHANGED_EVENT,
  MOABOM_SYSTEM_STORAGE_KEY,
  loadMoabomSystemState,
} from '../utils/moabomSystemStore';
import { invalidateMoabomLocaleSync, syncMoabomLocaleWithG7 } from './moabomSyncG7Locale';
import { useMoabomT } from './useMoabomT';
import { MoabomUiI18nContext } from 'moabom-shell-i18n';

export type { MoabomUiI18nContextValue } from 'moabom-shell-i18n';
export { MoabomUiI18nContext, useMoabomShellT } from 'moabom-shell-i18n';

/**
 * 홈·좌·우·중앙 패널 등 Moabom 셸 UI용 i18n.
 * `preferences.language`와 템플릿 lang JSON 오버레이를 맞추고, 마이페이지와 동일 저장소를 구독합니다.
 */
export function MoabomUiI18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<MoabomSystemLanguage>(
    () => loadMoabomSystemState().preferences.language as MoabomSystemLanguage,
  );
  const { t, bumpTranslationEpoch } = useMoabomT(language);

  useEffect(() => {
    const syncFromStorage = () => {
      const next = loadMoabomSystemState().preferences.language as MoabomSystemLanguage;
      setLanguage(prev => {
        if (prev === next) {
          return prev;
        }
        invalidateMoabomLocaleSync();
        return next;
      });
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === MOABOM_SYSTEM_STORAGE_KEY) {
        syncFromStorage();
      }
    };

    window.addEventListener(MOABOM_SYSTEM_STATE_CHANGED_EVENT, syncFromStorage);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener(MOABOM_SYSTEM_STATE_CHANGED_EVENT, syncFromStorage);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await syncMoabomLocaleWithG7(language);
      if (!cancelled) {
        bumpTranslationEpoch();
      }
    })();

    return () => {
      cancelled = true;
    };
    // bumpTranslationEpoch 은 useCallback([]) 로 안정 — language 변경 시에만 G7·오버레이 동기화
  }, [language]);

  const value = useMemo(() => ({ t, language }), [t, language]);

  return <MoabomUiI18nContext.Provider value={value}>{children}</MoabomUiI18nContext.Provider>;
}
