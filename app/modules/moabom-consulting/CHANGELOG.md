# Changelog

## [0.2.0] - 2026-06-07

### Changed

- 백엔드 계층 정렬(그누보드7 AGENTS.md 준수): `ContractService` 의 직접 모델 쿼리를 제거하고 `ContractRepositoryInterface` 로 위임.
- 계약 상태 하드코딩 문자열(`'signed'`/`'draft'`)을 `ContractStatus` Backed Enum 으로 대체하고 `Contract` 모델에 enum 캐스트 적용. API 응답 직렬화는 기존과 동일한 문자열 값 유지(동작 보존).

### Added

- `ContractRepositoryInterface` / `ContractRepository` 및 `ConsultingServiceProvider` 바인딩.
- `ContractStatus` Enum 및 상태 라벨 다국어 키(`status_draft`, `status_signed`).
- `ContractServiceTest` 회귀 테스트(Repository 위임, Enum 상태, 클라이언트 위조 시뮬레이션 결과 무시(C5) 검증).

## [0.1.0] - 2026-06-06

### Added

- 병원 대상 양압기 렌탈 영업용 태블릿 컨설팅 앱 모듈 신규 추가.
- 회사/비전 소개, 360 서비스 소개, 맞춤형 수익성 시뮬레이션, 전자계약서 서명 화면 제공.
- 계약 데이터는 `moabom_consulting_contracts` 테이블에 보관.
