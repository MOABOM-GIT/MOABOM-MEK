import type { App } from '../data/Moa_apps';
import type { StoredGeneratedAppSummary } from '../api/moabomAppsApi';
import { isGeneratedAppPublished } from '../api/moabomAppsApi';

const GENERATED_APP_GRADIENT_PALETTES = [
  ['#6366f1', '#8b5cf6'],
  ['#34d399', '#0d9488'],
  ['#38bdf8', '#1d4ed8'],
  ['#a78bfa', '#6366f1'],
  ['#22d3ee', '#3b82f6'],
  ['#fb923c', '#f43f5e'],
  ['#14b8a6', '#0ea5e9'],
  ['#c084fc', '#f472b6'],
  ['#06b6d4', '#2563eb'],
  ['#27bfc1', '#479ee2'],
] as const;

const GENERATED_APP_ICON_RULES: Array<{ icon: string; keywords: string[] }> = [
  { icon: 'calculator', keywords: ['계산', '계산기', '정산', 'calculator', 'calc'] },
  { icon: 'chart-line', keywords: ['차트', '그래프', '통계', '분석', '리포트', 'dashboard', 'chart', 'graph', 'report', 'analytics'] },
  { icon: 'calendar-alt', keywords: ['일정', '달력', '예약', 'calendar', 'schedule', 'booking'] },
  { icon: 'tasks', keywords: ['할일', '체크', '작업', 'todo', 'task', 'checklist'] },
  { icon: 'notes-medical', keywords: ['건강', '수면', '의료', '병원', 'health', 'sleep', 'medical', 'hospital'] },
  { icon: 'dumbbell', keywords: ['운동', '피트니스', 'fitness', 'workout', 'exercise'] },
  { icon: 'utensils', keywords: ['식단', '음식', '레시피', 'food', 'meal', 'recipe'] },
  { icon: 'wallet', keywords: ['가계부', '예산', '비용', 'budget', 'money', 'expense', 'finance'] },
  { icon: 'map-marker-alt', keywords: ['지도', '위치', '여행', 'map', 'location', 'travel'] },
  { icon: 'cube', keywords: ['3d', 'three', 'canvas', '공간', '입체'] },
  { icon: 'gamepad', keywords: ['phaser', '인터랙션', '시뮬레이션', 'quiz', 'game', 'simulation'] },
  { icon: 'paint-brush', keywords: ['색상', '디자인', '그림', 'color', 'design', 'draw', 'paint'] },
];

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

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function generatedAppGradient(seed: string): string {
  const palette = GENERATED_APP_GRADIENT_PALETTES[hashString(seed) % GENERATED_APP_GRADIENT_PALETTES.length];

  return `linear-gradient(135deg,${palette[0]},${palette[1]})`;
}

function generatedAppIcon(title: string, prompt: string | undefined, appType: string): string {
  const haystack = `${title} ${prompt ?? ''} ${appType}`.toLowerCase();
  const match = GENERATED_APP_ICON_RULES.find(rule => rule.keywords.some(keyword => haystack.includes(keyword.toLowerCase())));
  if (match) {
    return match.icon;
  }

  if (appType === '3d') return 'cube';
  if (appType === 'game') return 'gamepad';
  if (appType === 'dataviz') return 'chart-bar';

  return 'sparkles';
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
    icon: generatedAppIcon(title, promptHint, appType),
    gradient: generatedAppGradient(`${item.id}:${title}`),
    category: 'user',
    source: 'user-created',
    defaultLocale: 'ko',
    metadata: {
      generatedServerId: item.id,
      tier: item.tier ?? 'standard',
      isShared: isGeneratedAppPublished(item),
      visibility: item.visibility ?? (item.is_shared ? 'tenant' : 'private'),
      owner: item.owner,
      permissions: item.permissions,
    },
  };
}

/** URL·taskbar 복원용 최소 library App (제목은 뷰어 로드 후 갱신 가능) */
export function hydrateGeneratedPlaceholdersForOrder(
  order: string[],
  library: App[],
  customized = false,
): App[] {
  if (!customized) {
    return library;
  }

  if (order.length === 0) {
    return [];
  }

  const known = new Set(library.map(app => app.id));
  const placeholders: App[] = [];

  for (const id of order) {
    if (!isGeneratedLibraryAppId(id) || known.has(id)) {
      continue;
    }
    const synthetic = buildSyntheticGeneratedLibraryApp(id);
    if (synthetic) {
      placeholders.push(synthetic);
      known.add(id);
    }
  }

  return [...library, ...placeholders];
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
