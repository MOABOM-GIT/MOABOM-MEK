export type GeneratedAppIconRule = { icon: string; keywords: string[] };

export const GENERATED_APP_ICON_RULES: GeneratedAppIconRule[] = [
  { icon: 'calculator', keywords: ['계산', '계산기', '정산', '합계', '세금', '더하기', 'calculator', 'calc', 'tax'] },
  { icon: 'chart-line', keywords: ['차트', '그래프', '통계', '분석', '리포트', '대시보드', '시각화', 'dashboard', 'chart', 'graph', 'report', 'analytics', 'kpi'] },
  { icon: 'calendar-alt', keywords: ['일정', '달력', '예약', '스케줄', '약속', '미팅', 'calendar', 'schedule', 'booking', 'meeting', 'event'] },
  { icon: 'tasks', keywords: ['할일', '체크리스트', '체크', '작업', '메모', 'todo', 'task', 'checklist', 'memo'] },
  { icon: 'notes-medical', keywords: ['건강', '수면', '의료', '병원', '약', '보험', '공단', '양압', 'cpap', 'health', 'sleep', 'medical', 'hospital', 'pharmacy', 'insurance', 'nhis'] },
  { icon: 'dumbbell', keywords: ['운동', '피트니스', '헬스', '요가', 'fitness', 'workout', 'exercise', 'gym', 'yoga'] },
  { icon: 'utensils', keywords: ['식단', '음식', '레시피', '요리', '식당', 'food', 'meal', 'recipe', 'cook', 'restaurant'] },
  { icon: 'wallet', keywords: ['가계부', '예산', '비용', '지출', '수입', '급여', 'budget', 'money', 'expense', 'finance', 'salary'] },
  { icon: 'map-marker-alt', keywords: ['지도', '위치', '여행', '내비', '길찾기', 'map', 'location', 'travel', 'navigation'] },
  { icon: 'cube', keywords: ['3d', 'three', 'canvas', '공간', '입체', '모델', 'model'] },
  { icon: 'gamepad', keywords: ['게임', '퀴즈', '플레이', 'phaser', '인터랙션', '시뮬레이션', 'quiz', 'game', 'play', 'simulation'] },
  { icon: 'paint-brush', keywords: ['색상', '디자인', '그림', '스케치', '아트', 'color', 'design', 'draw', 'paint', 'sketch'] },
  { icon: 'building', keywords: ['회사', '기업', '법인', '오피스', '조직', 'company', 'corp', 'enterprise', 'office'] },
  { icon: 'globe', keywords: ['포털', '홈페이지', '사이트', '인터넷', 'portal', 'website', 'internet'] },
  { icon: 'comments', keywords: ['채팅', '대화', '메시지', '상담', 'chat', 'message', 'messenger', 'talk'] },
  { icon: 'music', keywords: ['음악', '노래', '오디오', '플레이리스트', 'music', 'song', 'audio', 'playlist'] },
  { icon: 'camera', keywords: ['사진', '카메라', '앨범', '갤러리', 'photo', 'camera', 'album', 'gallery', 'image'] },
  { icon: 'cloud-sun', keywords: ['날씨', '기온', '예보', 'weather', 'forecast', 'temperature'] },
  { icon: 'shopping-cart', keywords: ['쇼핑', '장바구니', '구매', '상점', 'shop', 'shopping', 'cart', 'store'] },
  { icon: 'book', keywords: ['책', '공부', '학습', '독서', '노트', 'book', 'study', 'learn', 'reading', 'note'] },
  { icon: 'code', keywords: ['코드', '개발', '프로그래밍', 'html', 'css', 'javascript', 'code', 'programming'] },
  { icon: 'clock', keywords: ['타이머', '알람', '시계', '시간', 'timer', 'alarm', 'clock', 'stopwatch'] },
  { icon: 'envelope', keywords: ['메일', '이메일', '편지', 'mail', 'email', 'inbox'] },
  { icon: 'users', keywords: ['팀', '회원', '커뮤니티', '그룹', 'team', 'member', 'community', 'group', 'users'] },
  { icon: 'home', keywords: ['홈', '집', '주거', 'home', 'house'] },
  { icon: 'lock', keywords: ['비밀번호', '보안', '잠금', '인증', 'password', 'security', 'lock', 'auth'] },
  { icon: 'video', keywords: ['영상', '비디오', '유튜브', '스트리밍', 'video', 'youtube', 'stream'] },
  { icon: 'car', keywords: ['자동차', '운전', '차량', '렌트', 'car', 'drive', 'vehicle', 'rental'] },
  { icon: 'bell', keywords: ['알림', '공지', '벨', 'notification', 'bell', 'alert', 'notice'] },
  { icon: 'robot', keywords: ['로봇', '인공지능', '챗봇', 'robot', 'chatbot', 'gpt', 'openai'] },
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
  // appType 은 키워드 매칭에 넣지 않음 — website_link/html_paste 등이 web·html 에 오매칭됨
  const haystack = `${title} ${prompt ?? ''}`.toLowerCase();
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
