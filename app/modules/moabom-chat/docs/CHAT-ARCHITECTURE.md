# Moabom Chat — 인스타그램 DM 수준 아키텍처 SSOT

목표: **웹 DM 체감** — 보내기 즉시 반영, 수신 1~3초, 앱 켜둔 동안 토스트·목록 동기화, 끊김 후 수 초 내 복구.

카카오/인스타 **네이티브 앱급**(앱 완전 종료 후 푸시)은 FCM 연동 시 Phase 4+.

---

## 1. 요구사항 매트릭스

| # | 요구 | Phase | 상태 |
|---|------|-------|------|
| R1 | 메시지 영구 저장·커서 페이지네이션 | 0 | ✅ |
| R2 | 낙관적 전송 + client_message_id 멱등 | 0 | ✅ |
| R3 | 실시간 수신 (WS) | 1–2 | ✅ + 인프라 timeout/affinity |
| R4 | 인박스 목록 실시간·정렬 | 1 | ✅ WS + `moabomShellChatSyncService` |
| R5 | 앱 켜둔 상태 토스트 | 1 | ✅ WS + 알림 폴링 fallback |
| R6 | WS 끊김 후 복구 | 1 | ✅ connection watch + catch-up |
| R7 | 읽음 처리 (대화 커서) | 0 | ✅ |
| R8 | 읽음 확인 UI | 2 | ✅ `peer_read` + `conversation.read` |
| R9 | 활성 대화 알림 억제 | 0 | ✅ focus + bridge |
| R10 | 차단·eligibility | 0 | ✅ |
| R11 | 타이핑 인디케이터 | 3 | ✅ `conversation.typing` |
| R12 | 메시지 삭제 | 3 | ✅ soft delete + `message.deleted` |
| R13 | 대화 mute | 3 | ✅ `muted_until` API |
| R14 | 탭 백그라운드 OS 알림 | 4 | ✅ Web Notification API |
| R15 | 앱 종료 FCM | 4+ | ⏳ 향후 |
| R16 | Reverb 멀티 인스턴스 | 2 | ⚠️ `max-instances=1` 고정 (단일 Reverb) |
| R17 | Cloud Run Billing Request-based | 2 | ✅ SSOT 고정 (`--cpu-throttling`) |

---

## 2. 계층 구조

```
Transport
  moabomWebSocketConnection      — deferred Pusher bind
  moabomShellRealtimeCoordinator — notification + inbox WS
  moabomShellChatSyncService     — REST catch-up + WS-down poll
  moabomShellChatBackgroundNotify — 탭 hidden 시 OS 알림

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

---

## 4. API (user)

| Method | Path | 용도 |
|--------|------|------|
| GET | `conversations` | 목록 |
| DELETE | `conversations/{uuid}` | 목록에서 삭제 (본인 멤버십 해제) |
| POST | `conversations/{uuid}/read` | 읽음 |
| POST | `conversations/{uuid}/typing` | 타이핑 |
| POST/DELETE | `conversations/{uuid}/mute` | 알림 mute |
| DELETE | `messages/{uuid}` | 본인 메시지 삭제 |

---

## 5. 인프라 (v335+)

- Cloud Run Billing: **Request-based** (`--cpu-throttling`) — SSOT `deploy/lib/cloud-run-service-flags.sh`, 가드 `deploy/check-cloud-run-billing-ssot.sh`
- Cloud Run: `--timeout=3600`, `--session-affinity`, `--max-instances=1`
- Reverb: 동일 컨테이너 sidecar `127.0.0.1:6001`
- 스모크: Reverb upgrade probe + chat routes

### Request-based 와 실시간 채팅

| 구분 | 영향 |
|------|------|
| HTTP API·로그인 | 영향 없음 (요청 처리 중 CPU 할당) |
| WS 연결 유지 중 | 연결이 활성 요청으로 잡히는 동안 CPU 유지 |
| Reverb sidecar (idle) | **요청 없을 때 CPU 스로틀** → ping·내부 브로드캐스트 지연·WS 끊김 가능 |
| 완화 | `moabomShellChatSyncService` REST 폴링 fallback, `min-instances=1` |

Instance-based(`--no-cpu-throttling`) 는 Reverb에 유리하나 **비용·정책상 Request-based 고정**.

---

## 6. 파일 SSOT

| 영역 | 경로 |
|------|------|
| 아키텍처 | `app/modules/moabom-chat/docs/CHAT-ARCHITECTURE.md` |
| 백엔드 | `app/modules/moabom-chat/src/` |
| 셸 동기화 | `app/templates/moabom-basic/src/runtime/moabomShellChatSyncService.ts` |
| 배포 | `deploy/build-and-deploy.sh`, `deploy/cloudbuild-v3.yaml` |
