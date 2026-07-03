# Changelog

## [0.1.29] - 2026-07-03

### Added

- 접속자 summary API에 `mirror_degraded` 필드를 추가해 플랫폼 DB 미연결 또는 heartbeat mirror 실패 시 UI가 플랫폼 집계 불일치를 인지할 수 있게 했습니다.

## [0.1.28] - 2026-06-30

### Changed

- 공개 프로필 패널 제목 「프로필」을 「소개」로 변경해 셸 프로필 탭 명칭과 맞췄습니다.

## [0.1.27] - 2026-06-29

### Removed

- `friend_removed` DB 알림 정의 — 친구 해제 당한 쪽(및 양측) 벨 알림 미발송. 해제 실행자는 클라이언트 토스트만.

## [0.1.26] - 2026-06-29

### Changed

- 접속자 revision 브로드캐스트를 즉시 전송하도록 변경해 실시간 목록 갱신 지연을 줄였습니다.

## [0.1.25] - 2026-06-28

### Added

- 접속자 revision을 DB 기반으로 관리하도록 개선해 여러 Cloud Run 인스턴스에서도 접속자·친구 목록 동기화 순서를 안정적으로 유지할 수 있도록 했습니다.

### Changed

- 단순 heartbeat 갱신만으로는 실시간 목록을 다시 불러오지 않도록 조정해 접속자 증가 시 불필요한 네트워크 요청을 줄였습니다.

## [0.1.24] - 2026-06-27

### Added

- 친구 요청·수락 시 `presence.revision` bump — 접속자 목록·프로필 친구 버튼 실시간 동기화
- `friend_accepted` 알림 — 요청자에게 수락 실시간 알림

### Changed

- `friendship.after_accept` 훅 추가 — 알림·확장 연동 SSOT

## [0.1.15] - 2026-06-24

### Fixed

- 테넌트 접속 시 플랫폼 접속자 집계 0명 — platform heartbeat가 `user_id`·미등록 `moabom_platform` 연결로 mirror 실패하던 문제 (`PlatformConnectionFactory` 등록 + `user_uuid` SSOT)
- 플랫폼 호스트·summary 경로에서도 platform DB 집계 쿼리 전 연결 등록 보장

## [0.1.14] - 2026-06-24

### Fixed

- 플랫폼 호스트(`mek360.com`)에서 presence `broadcasting/auth` 403 — 채널명 SSOT(`tenantId() ?? 'default'`)와 인가 콜백의 strict `tenantId()` 비교 불일치 수정 (`PresenceChannelNames::tenantSlug()` 사용)

## [0.1.13] - 2026-06-23

### Fixed

- heartbeat 저장 결과를 HTTP 오류와 분리 — 봇·스키마 미준비 상태는 `accepted: false` 데이터로 반환해 접속자 UI 콘솔 422 경고를 방지

## [0.1.12] - 2026-06-23

### Fixed

- heartbeat API 가 예외 시 500 대신 `accepted: false`(422) 반환 — 접속자 UI 연쇄 실패 방지

## [0.1.11] - 2026-06-23

### Fixed

- heartbeat 500 — `PresenceTenantSchema` SSOT 도입, `array_filter` 콜백 버그 제거
- 테넌트 세션·설정 upsert 는 스키마에 존재하는 컬럼만 기록 (마이그레이션 롤아웃 안전)

## [0.1.10] - 2026-06-23

### Fixed

- heartbeat upsert 시 테넌트 DB 스키마에 없는 컬럼은 자동 제외 — `client_form_factor` 마이그레이션 롤아웃 중 500 방지

## [0.1.9] - 2026-06-23

### Deprecated

- 셸 공개 프로필 UI SSOT는 `moabom-basic/layouts/users/show|posts` (G7 순정)로 이전. `user/public_profile` · `user/public_posts` 레이아웃은 더 이상 셸에서 사용하지 않음.

## [0.1.8] - 2026-06-23

### Changed

- 공개 프로필·작성글 레이아웃 고도화 — 프로필/작성글 탭, 통계 카드 줄바꿈 정렬, 최근·전체 게시글 한 줄 목록

## [0.1.7] - 2026-06-22

### Fixed

- 공개 프로필 레이아웃 `$t:moabom-presence.user.*` 번역 — `resources/lang/{ko,en}.json` 에 누락 키 추가 (프론트 병합 SSOT)

## [0.1.6] - 2026-06-22

### Changed

- 공개 프로필 셸 윈도우 JSON을 패널 구조로 재구성 — 프로필·게시글/댓글 통계·최근 게시글
- 작성글 전용 `user/public_posts` 레이아웃 추가 — 게시판별 작성글 목록

## [0.1.5] - 2026-06-22

### Added

- 접속 표시 설정 `show_avatar_in_connect_list` — 접속자·친구 목록 프로필 사진 노출 on/off (기본 on)

## [0.1.4] - 2026-06-22

### Fixed

- 로그인 heartbeat 시 동일 브라우저의 Laravel session 기반 guest 잔여 세션을 즉시 제거해 「방문자」 중복 노출 완화
- 접속자 목록에서 동일 `user_id` 인증 세션을 최신 heartbeat 1건만 표시

## [0.1.3] - 2026-06-22

### Changed

- 접속 세션 온라인 TTL 240초(heartbeat 60초 × 4) — 탭 스로틀 여유 확대

### Fixed

- 활동 정보 모드: heartbeat 전 설정(subtitle_mode) 선로드로 활동 문구가 DB·목록에 반영되도록 개선(셸 Provider)

## [0.1.2] - 2026-06-22

### Added

- 친구 요청 `friend_request` 알림 정의·`FriendshipNotificationDataListener`
- 유저 랭킹 API `user_uuid` 필드

### Fixed

- 공개 프로필 layout JSON 반복 렌더링(`iteration` 속성) G7 스키마 준수
- 접속자 패널: 바쁨/자리비움 시 활동 부제 유지(상태 점 색상만 변경)
- 접속 세션 TTL 180초·탭 복귀 시 heartbeat 즉시 갱신
- heartbeat 시 5분마다 stale 세션 DB 정리

## [0.1.1] - 2026-06-22

### Added

- `moabom:presence:platform-migrate` — platform DB 세션 테이블 운영 마이그레이션
- 셸 `/users/:uuid` 딥링크·프로필 윈도우 URL 동기화
- hospital-default SaaS 패키지·tenant-baseline runtime 테이블 등록

## [0.1.0] - 2026-06-22

### Added

- 테넌트·플랫폼 접속자 heartbeat 및 집계 API
- Reverb Presence 채널 (`module.moabom-presence.tenant.{slug}.online`)
- 테넌트 친구 관계(요청·수락·삭제) API
- 공개 프로필 G7 layout JSON (`user/public_profile`) — 셸 윈도우용
