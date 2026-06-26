/** 로케일 동기화 완료 — 셸 지연 로드 앱·오버레이 구독용 (경량, IIFE 번들에 sync 모듈 끌어오지 않음) */
export const MOABOM_LOCALE_SYNCED_EVENT = 'moabom:locale-synced';

/** shell-boot 페이로드 준비 완료 — site 로고 등 site 메타 구독용 */
export const MOABOM_SHELL_BOOT_LOADED_EVENT = 'moabom:shell-boot-loaded';

/** 부트 파이프라인 단계 전환 — 메인 카탈로그·2차 API 순서 조율용 */
export const MOABOM_BOOT_PHASE_CHANGED_EVENT = 'moabom:boot-phase-changed';
