# Changelog

## [0.2.2] - 2026-07-10

### Changed

- `GET user/credits?limit=0` — 잔액·`ranking_points`·`level`만 반환하고 원장 SUM/COUNT/목록을 생략합니다(셸 프로필 upstream timeout 완화).

## [0.2.1] - 2026-07-10

### Added

- `levels.thresholds` 설정(10단계) + `CreditLevelService` — `ranking_points` → 레벨·EXP 진행도 SSOT.
- 사용자 `GET user/credits` 응답에 `ranking_points`·`level` DTO 추가.
- 관리자 크레딧 설정에 레벨 구간 편집, 유저 크레딧 목록에 레벨 컬럼.

### Changed

- 관리자 크레딧 설정 저장 시 `levels` 카테고리 필수 검증(길이 10·비감소·Lv.1=0).

## [0.2.0] - 2026-06-29

### Added

- 플랫폼 **크레딧 관리** 화면 탭 UI — 크레딧 설정 / 유저 크레딧.
- 유저 크레딧 목록 API 및 관리자 수동 증감 API (`balances.read` / `balances.adjust` 권한).

### Changed

- 플랫폼 메뉴명을 「크레딧 관리」로 변경.

## [0.1.9] - 2026-06-25

### Added

- `moabom_credit_balances.ranking_points` — 유저별 누적 적립 포인트(랭킹 SSOT). 기존 적립 원장 백필 포함.

### Changed

- 적립 시 `ranking_points` 자동 증가(적립 이벤트 `source_type` 한정).

## [0.1.8] - 2026-06-25

### Added

- 적립 이벤트 자동 지급: 로그인·글 작성·댓글 작성 (`CreditRewardService` + 훅 리스너).
- 댓글 작성 적립 기본 2점·일일 20회 제한 설정 필드.
- 유저 셸 랭킹 캐시 무효화 리스너 (`moabom-credit.after_record`).

### Changed

- 크레딧 적립 `source_type` SSOT enum (`CreditRewardSourceType`).

## [0.1.7] - 2026-06-21

### Changed

- **크레딧 설정** 메뉴 순서를 플랫폼 메뉴 하위 order 40 으로 조정.

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
