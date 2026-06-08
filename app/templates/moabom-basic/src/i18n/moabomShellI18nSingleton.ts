import { createContext, useContext } from 'react';
import type { MoabomSystemLanguage } from '../types/moabomSystem';
import type { MoabomTranslateFn } from './moabomT';

/**
 * 셸 UI i18n Context는 메인 번들과 지연 로드 셸 IIFE가 **동일한 createContext 인스턴스**를
 * 참조해야 합니다. 셸 번들에 Provider가 중복 포함되면 useContext가 null이 됩니다.
 * @see window.__MoabomShellI18n (메인 `src/index.ts`에서 주입)
 */
export interface MoabomUiI18nContextValue {
  t: MoabomTranslateFn;
  language: MoabomSystemLanguage;
}

export const MoabomUiI18nContext = createContext<MoabomUiI18nContextValue | null>(null);

export function useMoabomShellT(): MoabomUiI18nContextValue {
  const ctx = useContext(MoabomUiI18nContext);
  if (!ctx) {
    throw new Error('useMoabomShellT는 MoabomUiI18nProvider 안에서만 사용할 수 있습니다.');
  }
  return ctx;
}
