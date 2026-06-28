/**
 * 정적 컨설팅 콘텐츠 (360 컨설팅.pptx 발췌).
 * 01. 회사&비전 소개 / 02. 360 서비스 소개 탭에서 사용.
 */

export interface CompanyFact {
  label: string;
  value: string;
}

export const COMPANY = {
  name: '㈜ 멕헬스케어 (MEK Healthcare)',
  tagline: '수면·호흡 케어 인프라와 검증된 전문성',
  facts: [
    { label: '설립일', value: '2016. 02. 02' },
    { label: '대표이사', value: '곽우섭' },
    { label: '인력 규모', value: '99명 (2026년 5월 기준)' },
    { label: '본사', value: '서울시 마포구 모래내로 7길 12, MEK 빌딩' },
    { label: '관리 환자', value: '13,000+ 명' },
    { label: '파트너 업체', value: '75+ 개소' },
  ] as CompanyFact[],
  branches: ['서울 본사', '대전 지사', '광주 지사', '대구 지사', '부산 지사', '파주 SCM 센터'],
  network: '전국 서울 본사를 기점으로 대전·광주·대구·부산 등 5개 주요 거점 지사를 운영하며, 국내 주요 의료기관 및 관련 업체와 파트너십을 보유하고 있습니다.',
};

export interface Competency {
  icon: string;
  title: string;
  description: string;
}

export const COMPETENCIES: Competency[] = [
  {
    icon: 'certificate',
    title: '업계 최초 ISO 13485 인증',
    description: '의료기기 렌탈 업계 최초로 국제 표준 품질 인증 ISO 13485를 획득했습니다. 자체 리퍼비시 센터를 통해 8단계 공정 및 정밀 검수를 직영으로 제공합니다.',
  },
  {
    icon: 'database',
    title: '데이터 기반 환자 관리 플랫폼',
    description: '자체 통합 전산 시스템 smart info로 환자 순응도를 모니터링하고, AI 데이터 분석 기반 맞춤형 교육·코칭으로 환자 이탈을 방지합니다.',
  },
  {
    icon: 'globe',
    title: '글로벌 기술력 및 제조 인프라',
    description: '프랑스 SOS Oxygène의 홈케어 노하우와 필립스 수면사업 M&A를 통한 고도화된 기술력을 보유. 단순 대리점을 넘어 제조사 기반 솔루션을 제공합니다.',
  },
];

export interface Service {
  key: string;
  icon: string;
  name: string;
  headline: string;
  description: string;
}

/** 360° 6대 핵심 서비스 (유기적으로 작동) */
export const SERVICES: Service[] = [
  {
    key: 'rental',
    icon: 'box-open',
    name: '렌탈',
    headline: '프리미엄 렌탈 서비스',
    description: '초기 비용 0원으로 멀티 브랜드 최신 장비를 렌탈합니다. 고가 장비 구매·감가상각·노후 리스크를 제거합니다.',
  },
  {
    key: 'refurbish',
    icon: 'recycle',
    name: '리퍼비시',
    headline: '표준화된 리퍼비시',
    description: 'ISO 13485 인증 센터에서 8단계 표준 공정으로 위생 신뢰도를 보장합니다. 자체 세척의 위생 한계를 해결합니다.',
  },
  {
    key: 'patient-care',
    icon: 'user-nurse',
    name: '환자관리',
    headline: '체계적인 환자관리 서비스',
    description: '전문 상담 관리사가 전담하고 데이터로 모니터링합니다. 간호사 상담 부하와 퇴사 시 관리 공백·이탈을 방지합니다.',
  },
  {
    key: 'billing',
    icon: 'file-invoice-dollar',
    name: '청구',
    headline: '전문적인 청구팀',
    description: '자동 청구 시스템과 전문 청구팀으로 산정 기준 오류·청구 누락을 차단합니다. 월 2시간 미만 청구 불가 규정과 미수 채권을 관리합니다.',
  },
  {
    key: 'info',
    icon: 'shield-halved',
    name: '정보관리',
    headline: '안전한 정보관리',
    description: '무상 프로그램으로 환자 정보·청구를 통합 관리합니다. 시스템 별도 구매로 인한 데이터 분절·관리 비효율을 제거합니다.',
  },
  {
    key: 'clinical',
    icon: 'graduation-cap',
    name: '임상지원',
    headline: '체계적인 교육 시스템',
    description: '건강보험공단 실사 기준 강화(월 1회 상담, 6개월 방문 점검)에 대응하는 체계적인 교육·임상 지원을 제공합니다.',
  },
];

/** 환자 케어 전주기 여정 */
export const PATIENT_JOURNEY = ['진단', '처방', '임대', '순응 중', '순응 후', '관리'];

export interface ComparisonRow {
  category: string;
  asIs: string;
  toBe: string;
}

/** 서비스 비교 분석: 업체(AS IS) vs 360(TO BE) — 슬라이드 17 */
export const COMPARISON: ComparisonRow[] = [
  { category: '장비', asIs: '고가 구매 지출 / 감가상각 & 노후 리스크', toBe: '초기 비용 0원 / 멀티 브랜드 최신 장비 렌탈' },
  { category: '리퍼비시', asIs: '자체 세척 한계 / 위생 신뢰도 저하', toBe: 'ISO 13485 인증 센터 / 8단계 표준 공정' },
  { category: '콜센터', asIs: '간호사 상담 부하 / 퇴사 시 관리 공백 & 이탈', toBe: '전문 상담 관리사 전담 / 데이터 모니터링' },
  { category: '청구', asIs: '복잡한 공정 / 산정기준 오류 시 청구 누락', toBe: '자동청구시스템 / 전문 청구팀 구축' },
  { category: '프로그램', asIs: '시스템 별도 구매 / 데이터 분절·관리 비효율', toBe: '무상 프로그램 제공 / 환자 정보·청구 관리' },
  { category: '건강보험공단', asIs: '위생·관리 기준 강화, 인프라 구축 필수', toBe: '실사 기준 강화 대응 (월 1회 상담, 6개월 방문 점검)' },
];
