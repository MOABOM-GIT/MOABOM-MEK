import type { AppTier } from '../../api/moabomAppsApi';

/**
 * Hosted 티어 생성 시 사용자 프롬프트에 덧붙이는 UX·저장 가이드.
 * i18n 키 `moa_apps_ai.hosted_modern_storage_prompt_addon` 과 동일 문구를 유지한다.
 */
export function appendHostedModernStoragePrompt(
  basePrompt: string,
  tier: AppTier,
  enabled: boolean,
  addon: string,
): string {
  const trimmed = basePrompt.trim();
  const extra = addon.trim();
  if (tier !== 'hosted' || !enabled || !extra) {
    return trimmed;
  }
  if (trimmed.includes(extra)) {
    return trimmed;
  }
  return trimmed ? `${trimmed}\n\n${extra}` : extra;
}
