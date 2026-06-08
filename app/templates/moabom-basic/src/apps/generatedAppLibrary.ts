import type { App } from '../data/Moa_apps';
import type { StoredGeneratedAppSummary } from '../api/moabomAppsApi';

const GENERATED_APP_GRADIENTS: Record<string, string> = {
  general: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
  '3d': 'linear-gradient(135deg,#22d3ee,#0891b2)',
  game: 'linear-gradient(135deg,#f472b6,#db2777)',
  dataviz: 'linear-gradient(135deg,#34d399,#059669)',
};

const GENERATED_APP_ICONS: Record<string, string> = {
  general: 'magic',
  '3d': 'cube',
  game: 'gamepad',
  dataviz: 'chart-bar',
};

export function generatedAppLibraryId(serverId: number): string {
  return `generated-app-${serverId}`;
}

export function isGeneratedLibraryAppId(appId: string): boolean {
  return appId.startsWith('generated-app-');
}

/** 셸 id `generated-app-{n}` → 서버 id (유효하지 않으면 null) */
export function parseGeneratedLibraryServerId(appId: string): number | null {
  if (!isGeneratedLibraryAppId(appId)) {
    return null;
  }
  const raw = appId.slice('generated-app-'.length);
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0 || String(id) !== raw) {
    return null;
  }
  return id;
}

/** API 생성 앱 목록 항목 → 마이페이지 library `App` 카드 */
export function mapStoredGeneratedAppToLibraryApp(item: StoredGeneratedAppSummary): App {
  const appType = item.app_type ?? 'general';
  const title = item.title?.trim() || `App #${item.id}`;
  const promptHint = item.prompt?.trim();
  const description = promptHint && promptHint.length > 0
    ? promptHint.slice(0, 120)
    : appType;

  return {
    id: generatedAppLibraryId(item.id),
    name: title,
    description,
    icon: GENERATED_APP_ICONS[appType] ?? 'magic',
    gradient: GENERATED_APP_GRADIENTS[appType] ?? GENERATED_APP_GRADIENTS.general,
    category: 'user',
    source: 'user-created',
    defaultLocale: 'ko',
  };
}

/** URL·taskbar 복원용 최소 library App (제목은 뷰어 로드 후 갱신 가능) */
export function buildSyntheticGeneratedLibraryApp(appId: string): App | null {
  const serverId = parseGeneratedLibraryServerId(appId);
  if (serverId == null) {
    return null;
  }
  return mapStoredGeneratedAppToLibraryApp({
    id: serverId,
    title: `App #${serverId}`,
    app_type: 'general',
  });
}
