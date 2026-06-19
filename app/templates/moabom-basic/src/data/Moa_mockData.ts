/**
 * MOABOM 임시 데이터 (Mock Data)
 *
 * 실제 API 연동 전까지 사용하는 홈 셸 보조 데이터입니다.
 * 앱 참조는 실제 등록된 시스템 앱만 유지합니다.
 */

/** 랭킹 데이터 */
export const RANKING_DATA = {
  apps: [
    { id: 'cpap-mask',     rank: 1, name: '마스크 피팅', icon: 'head-side-mask', gradient: 'linear-gradient(135deg,#06b6d4,#2563eb)', change: 'up' as const, category: 'basic' as const },
    { id: 'consulting',    rank: 2, name: '360 컨설팅', icon: 'handshake',      gradient: 'linear-gradient(135deg,#27bfc1,#479ee2)', change: 'same' as const, category: 'basic' as const },
    { id: 'hospital-info', rank: 3, name: '병원명',     icon: 'hospital',       gradient: 'linear-gradient(135deg,#14b8a6,#0ea5e9)', change: 'down' as const, category: 'basic' as const },
    { id: 'mypage',        rank: 4, name: '마이페이지', icon: 'user-cog',       gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)', change: 'same' as const, category: 'basic' as const },
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
    { id: 'cpap-mask',  name: '마스크 피팅', icon: 'head-side-mask', gradient: 'linear-gradient(135deg,#06b6d4,#2563eb)', category: 'basic' as const },
    { id: 'consulting', name: '360 컨설팅', icon: 'handshake',      gradient: 'linear-gradient(135deg,#27bfc1,#479ee2)', category: 'basic' as const },
  ],
  myapps: [],
};

import { MOA_SHELL_NOTICE_BOARD_SLUG } from '../shell/moaShellNoticeBoard';

export type ShellNoticeMockItem = {
  id: string;
  type: 'urgent' | 'event' | 'normal';
  title: string;
  desc: string;
  date: string;
  boardSlug: string;
  /** sirsoft-board 실제 글 ID — 없으면 목록만 연다 */
  postId?: string;
};

export type ShellUpdateMockItem = {
  id: string;
  version: string;
  title: string;
  desc: string;
  date: string;
  boardSlug: string;
  postId?: string;
};

/** 공지 데이터 (좌측 패널 → 게시판 윈도우 `notice` slug 연동) */
export const NOTICE_DATA = {
  notices: [
    {
      id: 'n1',
      type: 'urgent' as const,
      title: '서비스 점검 안내',
      desc: '12/25 02:00~06:00 점검',
      date: '2024.12.20',
      boardSlug: MOA_SHELL_NOTICE_BOARD_SLUG,
    },
    {
      id: 'n2',
      type: 'event' as const,
      title: '연말 이벤트 진행중',
      desc: '렌탈 할인 최대 30%',
      date: '2024.12.18',
      boardSlug: MOA_SHELL_NOTICE_BOARD_SLUG,
    },
    {
      id: 'n3',
      type: 'normal' as const,
      title: '이용약관 변경 안내',
      desc: '개인정보처리방침 개정',
      date: '2024.12.15',
      boardSlug: MOA_SHELL_NOTICE_BOARD_SLUG,
    },
  ] satisfies ShellNoticeMockItem[],
  updates: [
    {
      id: 'u1',
      version: 'v2.1.0',
      title: '수면 분석 기능 개선',
      desc: '리포트 요약·알림 로직 개선',
      date: '2024.12.19',
      boardSlug: MOA_SHELL_NOTICE_BOARD_SLUG,
    },
    {
      id: 'u2',
      version: 'v2.0.5',
      title: '버그 수정 및 안정화',
      desc: '크래시·동기화 이슈 패치',
      date: '2024.12.10',
      boardSlug: MOA_SHELL_NOTICE_BOARD_SLUG,
    },
    {
      id: 'u3',
      version: 'v2.0.0',
      title: '대규모 UI 업데이트',
      desc: '홈·마이페이지 레이아웃 재구성',
      date: '2024.12.01',
      boardSlug: MOA_SHELL_NOTICE_BOARD_SLUG,
    },
  ] satisfies ShellUpdateMockItem[],
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
