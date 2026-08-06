# Moabom Chat — 인스타그램 DM 수준 아키텍처 SSOT

목표: **웹 DM 체감** — 보내기 즉시 반영, 수신 1~3초, 앱 켜둔 동안 토스트·목록 동기화, 끊김 후 수 초 내 복구.

카카오/인스타 **네이티브 앱급**(앱 완전 종료 후 푸시)은 `moabom-fcm` (Firebase HTTP v1) + presence 오프라인 게이트.

---

## 1. 요구사항 매트릭스

| # | 요구 | Phase | 상태 |
|---|------|-------|------|
| R1 | 메시지 영구 저장·커서 페이지네이션 | 0 | ✅ |
| R2 | 낙관적 전송 + client_message_id 멱등 | 0 | ✅ |
| R3 | 실시간 수신 (WS) | 1–2 | ✅ + 인프라 timeout/affinity |
| R4 | 인박스 목록 실시간·정렬 | 1 | ✅ WS + `moabomShellChatSyncService` |
| R5 | 앱 켜둔 상태 토스트 | 1 | ✅ WS + 끊김/focus REST 폴백 (상시 unread 폴링 없음) |
| R6 | WS 끊김 후 복구 | 1 | ✅ connection watch + catch-up |
| R7 | 읽음 처리 (대화 커서) | 0 | ✅ |
| R8 | 읽음 확인 UI | 2 | ✅ `peer_read` + `conversation.read` |
| R9 | 활성 대화 알림 억제 | 0 | ✅ focus + bridge |
| R10 | 차단·eligibility | 0 | ✅ |
| R11 | 타이핑 인디케이터 | 3 | ✅ `conversation.typing` |
| R12 | 메시지 삭제 | 3 | ✅ soft delete + `message.deleted` |
| R13 | 대화 mute | 3 | ✅ `muted_until` (미지정 시 10년·사실상 무기한) |
| R14 | 탭 백그라운드 OS 알림 | 4 | ✅ Web Notification API |
| R15 | 앱 종료 FCM | 4+ | ✅ `moabom-fcm` + presence 오프라인 게이트 (설정·토큰 필요) |
| R16 | Reverb 멀티 인스턴스 | 2 | ✅ VM `realtime.mek360.com` + Redis scaling |
| R17 | Cloud Run Billing Request-based | 2 | ✅ SSOT 고정 (`--cpu-throttling`) |
| R18 | 브로드캐스트 즉시 전송 | 2 | ✅ `ShouldBroadcastNow` (큐 우회) |

---

## 2. 계층 구조

```
Transport
  moabomWebSocketConnection      — deferred Pusher bind
  moabomShellRealtimeCoordinator — notification + inbox WS
  moabomShellChatSyncService     — REST catch-up (WS-down / focus / 패널 진입만)
  moabomShellChatBackgroundNotify — 탭 hidden 시 OS 알림 (앱 생존)
  moabomFcmClient + moabom-fcm   — 앱 종료 시 FCM (presence 오프라인만)

Store
  moabomShellChatInboxCache
  moabomShellNotificationBridge
  ShellRealtimeStore

UI
  useMoabomChat / Moa_ChatPanel
  useMoabomShellNotifications

Backend (moabom-chat)
  ChatService — send, read, typing, mute, delete, broadcast
```

---

## 3. 이벤트·채널

| 채널 | 이벤트 | 용도 |
|------|--------|------|
| `module.moabom-chat.tenant.{id}.conversation.{uuid}` | `message.created` | 메시지 |
| 동일 | `conversation.read` | 읽음 확인 |
| 동일 | `conversation.typing` | 타이핑 |
| 동일 | `message.deleted` | 삭제 |
| `core.user.notifications.{uuid}` | `notification.received` | 토스트 |
| 동일 | `chat.inbox.updated` | 인박스 |
| 동일 | `chat.inbox.updated` (`reason: member.left`) | 상대 대화 나가기 |

**직렬화:** `is_writable`, `members[].has_left` — v0.2.1+

---

## 4. API (user)

| Method | Path | 용도 |
|--------|------|------|
| GET | `conversations` | 목록 |
| DELETE | `conversations/{uuid}` | 목록에서 삭제 (본인 멤버십 soft-delete) |
| POST | `conversations` | 대화 시작·재개 (direct 존재 시 trashed 멤버 복구) |

### 대화 나가기·재개 (DM SSOT)

| 동작 | 서버 | 클라이언트 |
|------|------|-----------|
| 목록 삭제 | `conversation_members` soft-delete — 목록 API 제외 | `markConversationLeft` 는 동일 세션 WS 레이스 필터만 |
| 프로필·메시지 탭 재연결 | `POST conversations` 가 direct 매칭 후 본인 멤버 복구 | `startWithUsers` + `clearConversationLeft` |
| 상대에게 | `member.left` 인박스 이벤트·`has_left` 표시 | 삭제 후 auto-start 차단 없음 (명시적 재개 허용) |

| POST | `conversations/{uuid}/read` | 읽음 |
| POST | `conversations/{uuid}/typing` | 타이핑 |
| POST/DELETE | `conversations/{uuid}/mute` | 알림 mute |
| DELETE | `messages/{uuid}` | 본인 메시지 삭제 |

---

## 5. 인프라 (v363+)

- Cloud Run Billing: **Request-based** (`--cpu-throttling`) — SSOT `deploy/lib/cloud-run-service-flags.sh`
- Cloud Run: `min-instances=0`, `max-instances=10`, `--timeout=3600`, `--session-affinity`
- **Reverb + Redis:** 전용 VM `realtime.mek360.com` (Cloud Run sidecar 제거)
- Laravel publish: `REVERB_SERVER_HOST=realtime.mek360.com:443` → VM nginx → Reverb
- 브로드캐스트: `ShouldBroadcastNow` — DB 큐 경유 없이 즉시 Reverb HTTP publish
- 스모크: `deploy/smoke-after-deploy.sh` Reverb probe + `deploy/check-realtime-vm-health.sh`

### FCM (앱 종료 푸시, R15)

| 항목 | 내용 |
|------|------|
| 플러그인 | `moabom-fcm` — GenericNotification `fcm` 채널 |
| 게이트 | presence `last_seen` TTL 내 온라인 → FCM skip (`notification_logs` skipped) |
| 실시간 | Reverb + Web Notification (탭 백그라운드) 유지 |
| 운영 | `MOABOM_FCM_*` + Secret Manager `MOABOM_FCM_SERVICE_ACCOUNT_JSON` — `deploy/docs/moabom-fcm.md` |

### Request-based 와 실시간 채팅

| 구분 | 영향 |
|------|------|
| HTTP API·로그인 | 영향 없음 (요청 처리 중 CPU 할당) |
| WS (브라우저) | VM Reverb 상시 구동 — Cloud Run CPU 스로틀과 무관 |
| Laravel → Reverb publish | 요청 스레드에서 동기 HTTP (큐 지연 없음) |
| 완화 | `moabomShellChatSyncService` — WS 끊김·focus·패널 진입 시 REST catch-up (연결 중 상시 폴링 없음) |

Instance-based(`--no-cpu-throttling`) 는 정책상 Request-based 고정. WS는 VM이 담당.

---

## 6. 파일 SSOT

| 영역 | 경로 |
|------|------|
| 아키텍처 | `app/modules/moabom-chat/docs/CHAT-ARCHITECTURE.md` |
| 백엔드 | `app/modules/moabom-chat/src/` |
| 셸 동기화 | `app/templates/moabom-basic/src/runtime/moabomShellChatSyncService.ts` |
| 배포 | `deploy/build-and-deploy.sh`, `deploy/cloudbuild-v3.yaml` |
