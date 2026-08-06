## [0.2.8] - 2026-08-05

### Changed

- 마이페이지 출석체크가 오늘 완료된 상태를 제공하고 다음 자정부터 다시 출석할 수 있도록 개선했습니다.

## [0.2.7] - 2026-07-28

### Added
- 스마트챗 데이터 카탈로그(`moabom.smart_chat.data_resources`)에 크레딧 리소스 직접 등록 — `my_credit_transactions`·`my_credit_attendances` (모두 본인 스코프)

## [0.2.6] - 2026-07-27

### Fixed
- Admin `admin_credit_settings` v1.2.4 — AI 사용 요금 필드를 레벨 구간과 같이 라벨+입력 셀·섹션 순서로 정리

## [0.2.5] - 2026-07-27

### Fixed
- Admin `admin_credit_settings` layout v1.2.3 — AI 요금 카드 전폭·힌트·page_intro, `ai_spend` 저장 required
- settings layout ↔ defaults ↔ lang 바인딩 정적 검사 (`check-module-settings-layout-bindings.sh`)

## [0.2.4] - 2026-07-27

### Added
- `ai_spend` 설정 카테고리 — AI 스마트챗·앱 만들기 개인 크레딧 차감 단가 (기본 비활성)
- Admin 크레딧 설정에 `attachment_surcharge` · `web_search_surcharge` · 토큰 정밀 과금 필드
