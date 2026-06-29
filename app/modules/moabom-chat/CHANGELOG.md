# Changelog

## [0.2.4] - 2026-06-30

### Changed

- 사용자-facing 문구를 「메시지/차단」 체계로 통일 — API 응답, 알림 정의, 권한 라벨, 차단·해제 토스트 포함.

## [0.2.3] - 2026-06-29

### Fixed

- 대화 나가기 시 본인 탭·기기에 `chat.inbox.updated` (`member.left.self`) 브로드캐스트 — 멀티 탭 목록 동기화.
- 나간 대화는 상대 메시지 WS로 목록이 복원되지 않도록 프론트 left-SSOT 연동.

## [0.2.2] - 2026-06-29

### Fixed

- 활성 대화 포커스 캐시를 DB 캐시 스토어로 분리해 Cloud Run 멀티 인스턴스에서도 알림 억제가 일관되게 동작하도록 개선했습니다.

## [0.2.1] - 2026-06-27

### Added

- 대화 나가기 시 상대방 `chat.inbox.updated` 실시간 브로드캐스트 (`reason: member.left`)
- `is_writable`·`members[].has_left` 직렬화 — 상대 나감 시 입력 비활성화 SSOT
- `conversation_peer_left` — API 전송·타이핑 차단

## [Unreleased]

### Added

- 대화 목록 개별 삭제 — `DELETE conversations/{uuid}` API 및 채팅 패널 삭제 버튼
- 목록에서 삭제한 1:1 대화 재시작 시 멤버십 자동 복구

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
