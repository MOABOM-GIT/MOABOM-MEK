# Changelog — moabom-fcm

## 0.2.4 — 2026-08-06

### Changed

- 시스템 알림을 인앱 토스트와 독립적으로 수신할 수 있도록 온라인 상태에서도 사용자 선택에 따라 발송합니다.
- 반복 알림을 기기별 알림 영역에서 같은 종류·대상 단위로 갱신하고 FCM 관리자 채널 기본값을 저장합니다.

## 0.2.3 — 2026-08-06

### Added

- 마이페이지의 사용자 푸시 수신 옵션을 FCM 채널 발송 시점에 적용합니다.

## 0.2.2 — 2026-08-06

### Changed

- FCM과 앱 백그라운드 알림이 동일한 알림 ID를 사용해 중복 OS 알림을 교체하도록 개선했습니다.

## 0.2.1 — 2026-07-12

### Fixed

- `web-config` 라우트를 `[Controller, '__invoke']` 형태로 바꿔 artisan/schema-sync 부트 시 Invalid route action 방지

## 0.2.0 — 2026-07-12

### Added

- 디바이스 토큰 테이블·등록/삭제 API (`platform`: web|android|ios)
- Laravel `fcm` Notification 채널 + `filter_available_channels` / `channel_readiness`
- 멀티 토큰 발송·무효 토큰 자동 삭제
- Presence `last_seen` 기반 온라인 시 FCM 생략
- 웹 공개 설정 API (`web-config`) — Firebase 웹 SDK용 (시크릿 제외)

### Changed

- 플러그인 설명을 골격에서 디바이스 푸시·알림 채널 연동으로 갱신

## 0.1.0 — 2026-06-29

- FCM HTTP v1 골격: `FcmClientInterface`, `NullFcmClient`, `GoogleFcmV1Client`
- `FcmPushService`, `moabom.fcm.status` 필터, `moabom.fcm.send` 액션
- 채팅·알림 모듈 연동은 후속 단계 (본 릴리스는 계약·상태만)
