# Changelog

## [0.2.0] - 2026-06-07

### Changed

- 백엔드 계층 정렬(그누보드7 AGENTS.md Controller→Service→Repository 준수): `UserMyPageActivityController` 의 직접 Eloquent 쿼리(`Post`/`Comment`)와 피드 변환 로직을 분리.
  - 데이터 접근은 `UserActivityRepositoryInterface` 로, 피드 조립·항목 변환은 `UserMyPageActivityService` 로 이관. 컨트롤러는 쿼리 파라미터 정규화와 응답/오류 처리만 담당.
  - 응답 payload(summary/items/query), 라벨·정렬·tenant 게시판 미설치 시 빈 피드(200) 동작은 기존과 100% 동일하게 보존.

### Added

- `UserActivityRepositoryInterface` / `UserActivityRepository`, `UserMyPageActivityService` 및 `PersonalizationServiceProvider` 바인딩.

## [0.1.0] - 2026-06-02

### Added

- `moabom-system`에서 분리한 사용자 개인화 모듈 신규 추가.
- 마이페이지 "내 활동" 피드 API: `/api/modules/moabom-personalization/user/activities`.
- `sirsoft-board`(게시판) 활동/상호작용 집계 노출. 게시판 테이블 부재 tenant 에서는 빈 피드를 정상 반환(graceful guard).
- 의존: `sirsoft-board >=1.0.0-beta.5`.
