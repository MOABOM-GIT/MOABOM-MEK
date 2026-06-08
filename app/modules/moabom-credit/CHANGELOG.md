# Changelog

## [0.1.6] - 2026-05-14

### Changed

- `g7_version`을 `>=7.0.0-beta.1,<8.0.0`로 조정
- `moabom-system` 의존 하한 `>=0.6.10`

## [0.1.5] - 2026-05-14

### Added

- MIT `LICENSE`

### Changed

- `moabom-system` 의존 버전 하한을 `>=0.6.9`로 조정

## [0.1.4] - 2026-05-14

### Changed

- `module.json`에 `moabom-system` 모듈 의존성 추가 — `parent_slug`/`platform-settings` 메뉴 동기화에 `moabom-system` 활성 필요

## [0.1.3] - 2026-05-14

### Changed

- 관리자 메뉴: **크레딧 설정**에 `parent_slug` → `platform-settings`, `order` 20(SNS 연결설정 다음) 적용

## [0.1.2] - 2026-05-03

### Fixed
- 크레딧 설정 메뉴가 플랫폼 환경설정 하위에 표시되도록 부모 메뉴 연결 보정

## [0.1.1] - 2026-05-03

### Added
- 출석체크 즉시 적립 API와 하루 1회 중복 방지 테이블 추가
- 플랫폼 환경설정 > 크레딧 설정 관리자 화면과 설정 API 추가
- 로그인, 글 작성, 좋아요 받음, 출석체크 적립액 및 일일 한도/광고 연동 준비 설정 추가

## [0.1.0] - 2026-05-03

### Added
- 마이페이지 크레딧 잔액과 거래 내역 API 추가
- 크레딧 잔액/거래 원장 테이블 추가
