/**
 * MOABOM 앱 데이터 정의
 */

import type { MoabomSystemLanguage } from '../types/moabomSystem';
import { cpapMaskFitAppMetadata } from '../apps/cpap-mask/metadata';
import { consultingAppMetadata } from '../apps/consulting/metadata';

/** 로케일별 표시 문자열 (사용자 생성 앱·백엔드 MT 결과 등) */
export type AppI18nEntry = {
  name?: string;
  description?: string;
};

export interface App {
  id: string;
  /** 작성자 언어 기준 원문 제목(API 연동 시 선택) */
  name: string;
  /** 작성자 언어 기준 원문 설명 */
  description: string;
  icon: string;
  gradient: string;
  category: 'basic' | 'user';
  source: 'system' | 'user-created';
  /** 원문 로케일(표시 우선순위 보조용, 미지정 시 클라이언트 폴백만 사용) */
  defaultLocale?: MoabomSystemLanguage;
  /** 동적 번역 맵 — 키가 없으면 템플릿 moa_apps.{id}.* 및 name/description 으로 폴백 */
  i18n?: Partial<Record<MoabomSystemLanguage, AppI18nEntry>>;
}

export const APPS: App[] = [
  { id: 'mypage',       name: '마이페이지',    description: '내 프로필과 설정 관리', icon: 'user-cog',      gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)', category: 'user', source: 'system' },
  consultingAppMetadata,
  cpapMaskFitAppMetadata,
  { id: 'app-maker',    name: '장비 렌탈',    description: '양압기 렌탈 신청',    icon: 'stethoscope',   gradient: 'linear-gradient(135deg,#a78bfa,#7c3aed)', category: 'basic', source: 'system' },
  { id: 'secret-text',  name: '렌탈 현황',    description: '내 렌탈 장비 조회',   icon: 'list-alt',      gradient: 'linear-gradient(135deg,#60a5fa,#2563eb)', category: 'basic', source: 'system' },
  { id: 'color-tool',   name: '장비 관리',    description: '장비 점검/교체',      icon: 'tools',         gradient: 'linear-gradient(135deg,#f472b6,#db2777)', category: 'basic', source: 'system' },
  { id: 'brain-gen',    name: '수면 분석',    description: '수면 데이터 리포트',  icon: 'chart-line',    gradient: 'linear-gradient(135deg,#34d399,#059669)', category: 'basic', source: 'system' },
  { id: 'decision',     name: 'AS 신청',      description: '방문 수리 접수',      icon: 'wrench',        gradient: 'linear-gradient(135deg,#fb7185,#e11d48)', category: 'basic', source: 'system' },
  { id: 'psych-test',   name: '사용 가이드',  description: '장비 사용 매뉴얼',    icon: 'book-open',     gradient: 'linear-gradient(135deg,#334155,#0f172a)', category: 'basic', source: 'system' },
  { id: 'quick-game',   name: '요금 조회',    description: '월 렌탈 요금 확인',   icon: 'won-sign',      gradient: 'linear-gradient(135deg,#fb923c,#ea580c)', category: 'basic', source: 'system' },
  { id: 'community',    name: '고객 센터',    description: '1:1 문의/상담',       icon: 'headset',       gradient: 'linear-gradient(135deg,#4ade80,#16a34a)', category: 'basic', source: 'system' },
  { id: 'device-info',  name: '장비 정보',    description: '모델별 스펙 안내',    icon: 'info-circle',   gradient: 'linear-gradient(135deg,#22d3ee,#0891b2)', category: 'basic', source: 'system' },
  { id: 'game-coupon',  name: '할인 쿠폰',    description: '렌탈 할인 혜택',      icon: 'ticket-alt',    gradient: 'linear-gradient(135deg,#a3e635,#65a30d)', category: 'basic', source: 'system' },
  { id: 'lotto-gen',    name: '건강 리포트',  description: '월간 수면 건강 분석', icon: 'heartbeat',     gradient: 'linear-gradient(135deg,#c084fc,#9333ea)', category: 'basic', source: 'system' },
  { id: 'qr-tool',      name: 'QR 등록',      description: '장비 QR 코드 등록',   icon: 'qrcode',        gradient: 'linear-gradient(135deg,#475569,#1e293b)', category: 'basic', source: 'system' },
  { id: 'mobile-guide', name: '배송 조회',    description: '렌탈 배송 현황',      icon: 'truck',         gradient: 'linear-gradient(135deg,#f87171,#dc2626)', category: 'basic', source: 'system' },
  { id: 'weather',      name: '내 장비',      description: '등록 장비 목록',      icon: 'stethoscope',   gradient: 'linear-gradient(135deg,#7dd3fc,#0284c7)', category: 'user', source: 'system' },
  { id: 'color-user',   name: '수면 기록',    description: '일별 수면 기록',      icon: 'moon',          gradient: 'linear-gradient(135deg,#c4b5fd,#7c3aed)', category: 'user', source: 'system' },
  { id: 'music',        name: '알림 설정',    description: '장비 알림 관리',      icon: 'bell',          gradient: 'linear-gradient(135deg,#f9a8d4,#ec4899)', category: 'user', source: 'system' },
  { id: 'task1',        name: '계약 정보',    description: '렌탈 계약 내역',      icon: 'file-contract', gradient: 'linear-gradient(135deg,#6ee7b7,#10b981)', category: 'user', source: 'system' },
  { id: 'task2',        name: '결제 내역',    description: '월 결제 이력',        icon: 'credit-card',   gradient: 'linear-gradient(135deg,#93c5fd,#3b82f6)', category: 'user', source: 'system' },
  { id: 'task3',        name: '포인트',       description: '적립 포인트 조회',    icon: 'star',          gradient: 'linear-gradient(135deg,#fca5a5,#ef4444)', category: 'user', source: 'system' },
];
