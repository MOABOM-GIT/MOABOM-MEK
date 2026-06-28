export type GeneratedAppIconRule = { icon: string; keywords: string[] };

export const GENERATED_APP_ICON_RULES: GeneratedAppIconRule[] = [
  { icon: 'calculator', keywords: ['계산', '계산기', '정산', 'calculator', 'calc'] },
  { icon: 'chart-line', keywords: ['차트', '그래프', '통계', '분석', '리포트', 'dashboard', 'chart', 'graph', 'report', 'analytics'] },
  { icon: 'calendar-alt', keywords: ['일정', '달력', '예약', 'calendar', 'schedule', 'booking'] },
  { icon: 'tasks', keywords: ['할일', '체크', '작업', 'todo', 'task', 'checklist'] },
  { icon: 'notes-medical', keywords: ['건강', '수면', '의료', '업체', '보험', '공단', 'health', 'sleep', 'medical', 'company', 'insurance', 'nhis'] },
  { icon: 'dumbbell', keywords: ['운동', '피트니스', 'fitness', 'workout', 'exercise'] },
  { icon: 'utensils', keywords: ['식단', '음식', '레시피', 'food', 'meal', 'recipe'] },
  { icon: 'wallet', keywords: ['가계부', '예산', '비용', 'budget', 'money', 'expense', 'finance'] },
  { icon: 'map-marker-alt', keywords: ['지도', '위치', '여행', 'map', 'location', 'travel'] },
  { icon: 'cube', keywords: ['3d', 'three', 'canvas', '공간', '입체'] },
  { icon: 'gamepad', keywords: ['phaser', '인터랙션', '시뮬레이션', 'quiz', 'game', 'simulation'] },
  { icon: 'paint-brush', keywords: ['색상', '디자인', '그림', 'color', 'design', 'draw', 'paint'] },
  { icon: 'building', keywords: ['회사', '기업', '법인', 'company', 'corp', 'enterprise', 'office'] },
  { icon: 'globe', keywords: ['포털', 'portal', 'website', 'web', '홈페이지', '사이트'] },
];

const APP_TYPE_ICON_FALLBACK: Record<string, string> = {
  '3d': 'cube',
  game: 'gamepad',
  dataviz: 'chart-bar',
  website_link: 'link',
};

/** AI·웹사이트 연결 앱 타이틀(·설명) 기반 Font Awesome 아이콘 이름 */
export function resolveGeneratedAppIconFromTitle(
  title: string,
  prompt?: string | null,
  appType = 'general',
): string {
  const haystack = `${title} ${prompt ?? ''} ${appType}`.toLowerCase();
  const match = GENERATED_APP_ICON_RULES.find(rule =>
    rule.keywords.some(keyword => haystack.includes(keyword.toLowerCase())),
  );
  if (match) {
    return match.icon;
  }

  return APP_TYPE_ICON_FALLBACK[appType] ?? 'sparkles';
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function expandShortHex(hex: string): string {
  const body = hex.replace(/^#/, '');
  if (body.length === 3) {
    return `#${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`;
  }
  return `#${body}`;
}

/** CSS 색 문자열 → `#rrggbb` (실패 시 null) */
export function normalizeWebsitePointColor(raw?: string | null): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }

  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return expandShortHex(trimmed).toLowerCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  const rgbMatch = trimmed.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgbMatch) {
    const r = clampChannel(Number(rgbMatch[1]));
    const g = clampChannel(Number(rgbMatch[2]));
    const b = clampChannel(Number(rgbMatch[3]));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  return null;
}

function shadeHexColor(hex: string, amount: number): string {
  const normalized = normalizeWebsitePointColor(hex) ?? '#6366f1';
  const body = normalized.slice(1);
  const r = parseInt(body.slice(0, 2), 16);
  const g = parseInt(body.slice(2, 4), 16);
  const b = parseInt(body.slice(4, 6), 16);
  const factor = 1 + amount / 100;
  const nr = clampChannel(r * factor);
  const ng = clampChannel(g * factor);
  const nb = clampChannel(b * factor);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

/** 웹사이트 포인트 컬러 기반 앱 타일 그라데이션 */
export function buildWebsiteLinkGradientFromPointColor(color?: string | null): string {
  const base = normalizeWebsitePointColor(color) ?? '#6366f1';
  const accent = shadeHexColor(base, -18);
  return `linear-gradient(135deg,${base},${accent})`;
}
