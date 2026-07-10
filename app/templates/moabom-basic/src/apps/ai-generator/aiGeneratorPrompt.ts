import type { AppTier } from '../../api/moabomAppsApi';

/**
 * Hosted(앱 서버 저장) 티어면 UX·온·오프라인 저장 가이드를 프롬프트에 항상 덧붙인다.
 * i18n 키 `moa_apps_ai.hosted_modern_storage_prompt_addon` 과 동일 문구를 유지한다.
 */
export function appendHostedModernStoragePrompt(
  basePrompt: string,
  tier: AppTier,
  addon: string,
): string {
  const trimmed = basePrompt.trim();
  const extra = addon.trim();
  if (tier !== 'hosted' || !extra) {
    return trimmed;
  }
  if (trimmed.includes(extra)) {
    return trimmed;
  }
  return trimmed ? `${trimmed}\n\n${extra}` : extra;
}
