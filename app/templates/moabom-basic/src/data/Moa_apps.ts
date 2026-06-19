/**
 * MOABOM 앱 데이터 정의
 */

import type { MoabomSystemLanguage } from '../types/moabomSystem';
import { asRequestAppMetadata } from '../apps/as-request/metadata';
import { cpapMaskFitAppMetadata } from '../apps/cpap-mask/metadata';
import { cpapRentalAppMetadata } from '../apps/cpap-rental/metadata';
import { cpapReturnAppMetadata } from '../apps/cpap-return/metadata';
import { consultingAppMetadata } from '../apps/consulting/metadata';
import { hospitalInfoAppMetadata } from '../apps/hospital-info/metadata';
import { refurbRequestAppMetadata } from '../apps/refurb-request/metadata';
import { rentalDashboardAppMetadata } from '../apps/rental-dashboard/metadata';
import { settlementAppMetadata } from '../apps/settlement/metadata';

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
  /** 동적 앱의 서버 상태 등 앱 카드 부가 정보 */
  metadata?: Record<string, unknown>;
}

export const APPS: App[] = [
  hospitalInfoAppMetadata,
  { id: 'mypage',       name: '마이페이지',    description: '내 프로필과 설정 관리', icon: 'user-cog',      gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)', category: 'basic', source: 'system' },
  consultingAppMetadata,
  cpapMaskFitAppMetadata,
  cpapRentalAppMetadata,
  cpapReturnAppMetadata,
  asRequestAppMetadata,
  refurbRequestAppMetadata,
  rentalDashboardAppMetadata,
  settlementAppMetadata,
];
