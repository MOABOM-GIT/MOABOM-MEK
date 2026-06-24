# Changelog

## [0.1.2] - 2026-06-24

### Added

- 배포 게이트 `scripts/check-moabom-chat-api-ssot.sh` — blocks·eligibility 라우트·프론트 SSOT 정합성 검사
- 스모크 `deploy/smoke-after-deploy.sh` — moabom-chat blocks·eligibility·DELETE destroy 라우트 등록 확인

### Fixed

- `blocks/{userUuid}`·`users/{userUuid}/eligibility` 라우트 UUID `where` 정규식 오타 수정 — 잘못된 패턴으로 실제 UUID URL이 매칭되지 않아 404가 발생하던 문제

### Changed

- 프론트 채팅 API를 `moabomShellHttp` SSOT로 통합 — 프로필·채팅 패널이 동일 엔드포인트·재시도 정책 공유
- `ChatServiceProvider` booted 보완 등록 — api.php 부분 배포 시 blocks destroy·eligibility 라우트 404 방지

## [0.1.1] - 2026-06-23

### Added

- 대화방 포커스 API — 열람 중인 대화방에 대한 database 알림 억제
- 채팅 알림 `click_url` — `/users/{sender_uuid}/chat` 딥링크

### Changed

- 채팅 알림 발송 시 포커스 중인 수신자는 알림 대상에서 제외
