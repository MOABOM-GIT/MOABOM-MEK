/**
 * MOABOM 임시 데이터 (Mock Data)
 *
 * 실제 API 연동 전까지 사용하는 더미 데이터입니다.
 * 추후 API 연동 시 이 파일을 제거하고 data_sources로 대체합니다.
 */

/** 랭킹 데이터 */
export const RANKING_DATA = {
  apps: [
    { id: 'app-maker',  rank: 1, name: '장비 렌탈', icon: 'stethoscope', gradient: 'linear-gradient(135deg,#a78bfa,#7c3aed)', change: 'up' as const, category: 'basic' as const },
    { id: 'brain-gen',  rank: 2, name: '수면 분석', icon: 'chart-line',  gradient: 'linear-gradient(135deg,#34d399,#059669)', change: 'same' as const, category: 'basic' as const },
    { id: 'community',  rank: 3, name: '고객 센터', icon: 'headset',     gradient: 'linear-gradient(135deg,#4ade80,#16a34a)', change: 'down' as const, category: 'basic' as const },
    { id: 'quick-game', rank: 4, name: '요금 조회', icon: 'won-sign',    gradient: 'linear-gradient(135deg,#fb923c,#ea580c)', change: 'up' as const, category: 'basic' as const },
    { id: 'decision',   rank: 5, name: 'AS 신청',   icon: 'wrench',      gradient: 'linear-gradient(135deg,#fb7185,#e11d48)', change: 'same' as const, category: 'basic' as const },
  ],
  users: [
    { rank: 1, name: '성현_Master', avatar: 'SH', color: 'linear-gradient(135deg,#667eea,#764ba2)', point: 12500, change: 'up' as const },
    { rank: 2, name: '민지_Design', avatar: 'MJ', color: 'linear-gradient(135deg,#ff9a9e,#fecfef)', point: 11200, change: 'same' as const },
    { rank: 3, name: 'Kyle_Dev',    avatar: 'K',  color: 'linear-gradient(135deg,#84fab0,#8fd3f4)', point: 9800,  change: 'up' as const },
    { rank: 4, name: '지수_PM',     avatar: 'JS', color: 'linear-gradient(135deg,#a18cd1,#fbc2eb)', point: 8500,  change: 'down' as const },
    { rank: 5, name: '현우_QA',     avatar: 'HW', color: 'linear-gradient(135deg,#ffecd2,#fcb69f)', point: 7200,  change: 'same' as const },
  ],
};

/** 마이앱 데이터 */
export const MY_APPS_DATA = {
  favorites: [
    { id: 'app-maker',  name: '장비 렌탈', icon: 'stethoscope', gradient: 'linear-gradient(135deg,#a78bfa,#7c3aed)', category: 'basic' as const },
    { id: 'brain-gen',   name: '수면 분석', icon: 'chart-line',  gradient: 'linear-gradient(135deg,#34d399,#059669)', category: 'basic' as const },
    { id: 'community',   name: '고객 센터', icon: 'headset',     gradient: 'linear-gradient(135deg,#4ade80,#16a34a)', category: 'basic' as const },
  ],
  myapps: [
    { id: 'weather',     name: '내 장비',   icon: 'stethoscope', gradient: 'linear-gradient(135deg,#7dd3fc,#0284c7)', category: 'user' as const },
    { id: 'color-user',  name: '수면 기록', icon: 'moon',        gradient: 'linear-gradient(135deg,#c4b5fd,#7c3aed)', category: 'user' as const },
  ],
};

/** 공지 데이터 */
export const NOTICE_DATA = {
  notices: [
    { id: 'n1', type: 'urgent' as const, title: '서비스 점검 안내',    desc: '12/25 02:00~06:00 점검',  date: '2024.12.20' },
    { id: 'n2', type: 'event' as const,  title: '연말 이벤트 진행중',  desc: '렌탈 할인 최대 30%',      date: '2024.12.18' },
    { id: 'n3', type: 'normal' as const, title: '이용약관 변경 안내',  desc: '개인정보처리방침 개정',   date: '2024.12.15' },
  ],
  updates: [
    { id: 'u1', version: 'v2.1.0', title: '수면 분석 기능 개선', desc: '리포트 요약·알림 로직 개선', date: '2024.12.19' },
    { id: 'u2', version: 'v2.0.5', title: '버그 수정 및 안정화', desc: '크래시·동기화 이슈 패치', date: '2024.12.10' },
    { id: 'u3', version: 'v2.0.0', title: '대규모 UI 업데이트', desc: '홈·마이페이지 레이아웃 재구성', date: '2024.12.01' },
  ],
};

/** 접속자 데이터 */
export const ONLINE_USERS = [
  { i: 'SH', n: '성현_Master', s: '메인 대시보드 보는 중', c: 'linear-gradient(135deg,#667eea,#764ba2)', online: true },
  { i: 'MJ', n: '민지_Design', s: '텍스쳐 탐색 중',       c: 'linear-gradient(135deg,#ff9a9e,#fecfef)', online: true },
  { i: 'K',  n: 'Kyle_Dev',    s: '15분 전 활동',          c: 'linear-gradient(135deg,#84fab0,#8fd3f4)', online: false },
];

/** 친구 데이터 */
export const FRIENDS_DATA = [
  { n: '프론트엔드장인', s: '"오늘은 코딩 불태우자"',  c: '#3b82f6', online: true },
  { n: '디자인팀장',     s: '회의중입니다 ㅠ',         c: '#10b981', online: true },
  { n: '카페24마스터',   s: '마지막 접속: 어제',       c: '#6b7280', online: false },
];

/** 알림 데이터 */
export const NOTIFICATIONS_DATA = [
  { icon: 'heart',   iconColor: 'text-pink-500 dark:text-pink-400',  iconBg: 'bg-pink-50 dark:bg-pink-950/35',  title: '좋아요 알림', desc: '디자인팀장님이 회원님의 게시글을 좋아합니다.', time: '방금',     unread: true },
  { icon: 'comment', iconColor: 'text-blue-500 dark:text-blue-400',  iconBg: 'bg-blue-50 dark:bg-blue-950/35',  title: '새 댓글',     desc: '성현_Master: "이 부분 수정 부탁드립니다.."',   time: '5분 전',   unread: true },
  { icon: 'bell',    iconColor: 'text-slate-400 dark:text-slate-500', iconBg: 'bg-gray-50 dark:bg-slate-800/60',  title: '시스템 알림', desc: '비밀번호 변경이 완료되었습니다.',               time: '1시간 전', unread: false },
];
