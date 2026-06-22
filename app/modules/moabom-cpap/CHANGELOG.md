# Changelog

## [0.2.1] - 2026-06-21

### Added

- 관리자 **마스크피팅 관리** 메뉴·목록 API·레이아웃 — 플랫폼 메뉴 하위(order 60), `moabom-cpap.measurements.read` 권한.

## [0.2.0] - 2026-06-07

### Changed

- 백엔드 계층 정렬(그누보드7 AGENTS.md 준수): `CpapMeasurementService` 의 직접 모델 쿼리(`CpapMeasurement::query()`)를 제거하고 `CpapMeasurementRepositoryInterface` 로 위임.
- 추천 마스크 표준 타입/표시명 도출 로직을 `MaskType` Backed Enum 으로 단일화. `mask_type` 컬럼 저장값·`recommendation.type`·표시명은 기존과 100% 동일(동작 보존).

### Added

- `CpapMeasurementRepositoryInterface` / `CpapMeasurementRepository` 및 `CpapServiceProvider` 바인딩.
- `MaskType` Enum 및 `MaskTypeTest`.

### Notes

- 추천 `reasons`/`tips`/`name` 문자열은 프론트엔드 `recommendMask`(cpapMeasurement.ts)와 1:1 일치해야 하는 저장 데이터값이므로, 로케일별 값 분기로 "무손상" 보장이 깨지는 것을 막기 위해 의도적으로 `__()` 다국어화하지 않음.

## [0.1.0] - 2026-06-02

### Added

- `moabom-system`에서 분리한 CPAP 마스크 피팅 측정 모듈 신규 추가.
- 사용자별 마스크 피팅 측정 저장/조회 API: `/api/modules/moabom-cpap/apps/cpap-mask/*`.
- 안면 측정값·추천 결과는 `moabom_system_cpap_measurements` 테이블에 보관(기존 테이블명·데이터 호환 유지, `Schema::hasTable` 멱등 가드).
