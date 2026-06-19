import type { App } from '../../data/Moa_apps';
import type { MoabomSystemLanguage } from '../../types/moabomSystem';

type LocaleStrings = { name: string; description: string };

type ShellAppStrings = Record<MoabomSystemLanguage, LocaleStrings>;

/**
 * 셸 앱 카탈로그 메타데이터 — ko 원문 + i18n 맵을 한 번에 정의한다.
 */
export function createShellAppMetadata(config: {
  id: string;
  icon: string;
  gradient: string;
  strings: ShellAppStrings;
}): App {
  const { ko } = config.strings;

  return {
    id: config.id,
    name: ko.name,
    description: ko.description,
    defaultLocale: 'ko',
    icon: config.icon,
    gradient: config.gradient,
    category: 'basic',
    source: 'system',
    i18n: config.strings,
  };
}
