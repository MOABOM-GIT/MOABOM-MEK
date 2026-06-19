import { useMemo } from 'react';
import type { App } from '../data/Moa_apps';
import { useMoabomShellT } from './MoabomUiI18nProvider';
import { resolveAppStrings, type ResolvedAppStrings } from './resolveAppStrings';
import { useMoabomSiteDisplayName } from '../utils/moabomSiteBranding';

/**
 * MoabomUiI18nProvider 로케일·번역 함수를 사용해 앱 이름·설명을 해석합니다.
 * 언어 변경 시 자동 리렌더됩니다.
 */
export function useResolvedAppStrings(app: App): ResolvedAppStrings {
  const { t, language } = useMoabomShellT();
  const siteDisplayName = useMoabomSiteDisplayName();

  return useMemo(
    () => resolveAppStrings(app, language),
    [app, language, t, siteDisplayName],
  );
}
