/**
 * MOABOM 네비게이션 및 모드 데이터
 */

export interface NavItem {
  id: string;
  icon: string;
  label: string;
}

export interface Mode {
  id: string;
  name: string;
  desc: string;
  icon: string;
}

/** 좌측 패널 하단 네비게이션 아이템 */
export const NAV_ITEMS: NavItem[] = [
  { id: 'launcher', icon: 'grip',         label: '모든앱' },
  { id: 'economy',  icon: 'chart-simple', label: '랭킹' },
  { id: 'myapp',    icon: 'star',         label: '마이앱' },
  { id: 'notice',   icon: 'bell',         label: '공지' },
];

/** 중앙 패널 모드 선택 드롭다운 */
export const MODES: Mode[] = [
  { id: 'apps',  name: 'SMARTCARE APPS',  desc: '다양한 앱을 탐색하세요', icon: 'grip' },
  { id: 'sites', name: 'SMARTCARE SITES', desc: '웹사이트 모음',          icon: 'globe' },
  { id: 'work',  name: 'SMARTCARE WORK',  desc: '업무용 도구 모음',       icon: 'briefcase' },
];
