import { APPS, type App } from '../data/Moa_apps';
import { resolveAppStrings } from '../i18n/resolveAppStrings';
import type { MoabomSystemLanguage } from '../types/moabomSystem';
import type { ShellAppRankingItem } from './moaShellRankingTypes';

const FALLBACK_EXCLUDED_APP_IDS = new Set([
  'mypage',
  'create-app',
  'login',
  'register',
  'forgot-password',
  'reset-password',
]);

const FALLBACK_SORT_LOCALE: MoabomSystemLanguage = 'ko';
const FALLBACK_LIMIT = 30;

function isFallbackRankingApp(app: App): boolean {
  if (FALLBACK_EXCLUDED_APP_IDS.has(app.id)) {
    return false;
  }

  if (app.id.startsWith('moa-shell-')) {
    return false;
  }

  return app.category === 'basic' && app.source === 'system';
}

/**
 * 실사용 집계 전 테넌트 초기 화면용 — 기본 시스템 앱을 가나다순으로 채우고 등락은 모두 유지(same).
 */
export function buildFallbackShellAppRankings(
  libraryApps: App[] = APPS,
): ShellAppRankingItem[] {
  const seen = new Set<string>();
  const candidates: App[] = [];

  for (const app of libraryApps) {
    if (!isFallbackRankingApp(app) || seen.has(app.id)) {
      continue;
    }
    seen.add(app.id);
    candidates.push(app);
  }

  candidates.sort((left, right) => {
    const leftName = resolveAppStrings(left, FALLBACK_SORT_LOCALE).name;
    const rightName = resolveAppStrings(right, FALLBACK_SORT_LOCALE).name;
    const byName = leftName.localeCompare(rightName, FALLBACK_SORT_LOCALE);
    if (byName !== 0) {
      return byName;
    }

    return left.id.localeCompare(right.id, 'en');
  });

  return candidates.slice(0, FALLBACK_LIMIT).map((app, index) => ({
    app_id: app.id,
    rank: index + 1,
    change: 'same' as const,
    open_hits: 0,
    active_seconds: 0,
    score: 0,
  }));
}
