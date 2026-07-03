# Moabom 실시간 시스템 리팩토링 v4 — 검증·설계·단계 계획

> **작성:** 2026-07-03 · 코드 워킹트리 직접 검증 (기존 SSOT 문서는 참고만, 불일치 시 본 문서 우선)  
> **상위 참고:** `moabom-shell-realtime-architecture.md`, `moabom-realtime-plane-v3.md`, `deploy/moabom-realtime-vm.md`

---

## 1. 검증된 운영 토폴로지

```
[Browser] Echo/Pusher ──wss──► realtime.mek360.com (VM nginx → Reverb :6001)
                                      ▲
                                      │ Redis 7 (REVERB_SCALING_ENABLED)
[Cloud Run Laravel] ──HTTP publish───┘  REVERB_SERVER_HOST=realtime.mek360.com:443
        │
   MySQL (tenant + platform) · CACHE_STORE=file · QUEUE_CONNECTION=database
```

| 항목 | 검증 결과 |
|------|-----------|
| Cloud Run sidecar Reverb | **사용 안 함** (`check-before-cloud-build.sh` 검증) |
| Run Redis | **없음** — VM Reverb scaling 전용 |
| 브로드캐스트 경로 | `HookManager::broadcast` → `GenericBroadcastEvent` (**ShouldBroadcastNow**) |
| 클라이언트 WS | `REVERB_HOST` / SaaS `drivers.websocket_*` → `G7Core.websocket` |
| 인증 | `/api/broadcasting/auth` + Sanctum Bearer (코어 `WebSocketManager`) |

### 기존 문서 정정 (v3 등)

| 문서 표현 | 실제 |
|-----------|------|
| `moabom-realtime-plane-v3.md` §1 "Reverb sidecar (동일 Cloud Run 컨테이너)" | **오류** — VM 분리 완료 (`deploy/moabom-realtime-vm.md` SSOT) |
| revision → "summary+online+friends 한 번만" | **미구현** — 현재 3 API 병렬 refetch |
| `private-user.{uuid}` 채널명 | **구식** — 실제: `core.user.notifications.{uuid}` |

---

## 2. 프론트 실시간 스택 (검증)

| 계층 | 파일 | 역할 |
|------|------|------|
| G7 코어 | `resources/js/core/websocket/WebSocketManager.ts` | Echo 싱글톤, `channel:event` 키, 중복 구독 시 기존 키 반환 |
| 연결 | `moabomWebSocketConnection.ts`, `moabomWebSocketAuthSync.ts` | 연결 상태·로그인 재인증 |
| 코디네이터 | `moabomShellRealtimeCoordinator.ts` | private 알림+인박스 구독 수명 |
| 디스패치 | `ShellRealtimeStore.ts` | handler Set, debounce 300ms |
| 안전망 | `moabomShellChatSyncService.ts` | WS 끊김 REST 폴링 |
| 도메인 소켓 | `moabomChatSocket.ts`, `moabomPresenceSocket.ts`, … | 채널별 subscribe 래퍼 |
| UI 훅 | `useMoabomChat.ts`, `MoabomPresenceProvider.tsx` | React 상태·구독 |

---

## 3. 확인된 P0 결함 — 채팅 이중 구독

### 증상

대화창에서 상대 메시지가 간헐적으로 실시간 미수신. 대화 전환 후 특정 채널에서 구독 누락.

### 원인 (코드 검증)

`useMoabomChat.ts`에 **두 개의 useEffect**가 동일 채널에 겹침:

1. **Effect A** — `subscribeChatConversations(전체)` → `message.created`, `typing`, `message.deleted`
2. **Effect B** — `subscribeChatConversation(활성)` → 동일 3이벤트 + `conversation.read`

`WebSocketManager.subscribe`는 동일 `channel:event`에 **리스너 중복 등록 없이 기존 키만 반환** (L329–331).

`unsubscribe`는 해당 이벤트에 `stopListening` (L364–378).

**Effect B cleanup**이 활성 대화 변경 시 `message.created` 등 키를 해제 → **Effect A는 재실행되지 않아** 해당 채널 리스너 영구 소실.

### 수정 (Phase 1)

- Effect B **제거**
- Effect A에 `onRead` 핸들러 통합 (`activeConversationRef`로 활성 대화만 처리)
- 구독 소유권 **단일 Effect**

---

## 4. 시스템별 현황·목표

| 시스템 | WS | REST | 주요 이슈 | Phase |
|--------|-----|------|-----------|-------|
| 채팅 | conversation private + inbox | messages, conversations | **P0 이중 구독** | **1** |
| 알림 | `notification.received` | notifications API | 인박스와 채널 공유 (설계상 OK) | 2 |
| 접속자 | `presence.revision` | summary, online, heartbeat | Provider 전역 리렌더 | 2 |
| 친구 | revision 간접 | friends API | friendship 시 3-way refetch | 2 |
| 앱 커뮤니티 | `app_community.revision` | community API | ~~큐 지연~~ **Now** (v0.5.9) | 3 ✓ |
| 게시판 | 없음 | sirsoft-board | 창마다 layout fetch | 4 |
| 리뷰 | 없음 | sirsoft-ecommerce | moabom WS 없음 | 4 |
| AI 앱 | SSE | generate/stream | concurrency 제한 | — |

---

## 5. 이벤트 계약 (검증 SSOT)

| 채널 | 이벤트 | 전송 | 소비 |
|------|--------|------|------|
| `module.moabom-chat.tenant.{slug}.conversation.{uuid}` | `message.created`, `conversation.typing`, `conversation.read`, `message.deleted` | Now | `useMoabomChat` |
| `core.user.notifications.{uuid}` | `chat.inbox.updated` | Now | coordinator → inbox cache |
| `core.user.notifications.{uuid}` | `notification.received` | Now | notification bridge |
| `module.moabom-presence.tenant.{slug}.revision` | `presence.revision` | Now, public | PresenceProvider |
| `moabom-app-community.{appId}` | `app_community.revision` | **Now** | `useAppCommunity` |

---

## 6. 단계별 구현 계획

### Phase 0 — 기준선

- [x] 워킹트리 검증·본 문서 작성
- [x] 미커밋 변경 커밋·push

### Phase 1 — P0 채팅 구독 (현재)

- [x] `useMoabomChat` 단일 구독 Effect
- [x] `moabom-basic` CHANGELOG
- [x] Cloud Build 배포 (v424)

### Phase 2 — P0/P1 Presence·렌더 (완료, v425)

- [x] `MoabomPresenceProvider` Context 분할 (summary / online / friends / settings)
- [x] `presence.revision` reason별 선택 refetch
- [x] WS 재연결 refetch를 `ShellRealtimeStore` coalescer로 통합
- [x] Cloud Build 배포 v425

### Phase 3 — P1 앱 커뮤니티·이벤트 정합 (완료)

- [x] `AppCommunityRevisionBroadcastEvent` → `ShouldBroadcastNow`
- [x] Cloud Build 배포 v426

### Phase 4 — P2 Shell Surface·Visitor (완료)

- [x] `shellSurfaceController` SSOT · 프로필 remount key
- [x] `ShellContextBridge` — board·profile layout 경로에서 `publishShellLayoutContext` (기존)
- [x] `mirror_degraded` — platform mirror 실패 명시 (summary API)
- [x] Cloud Build 배포 v427 (`mobaom-container-00480-fnn`; smoke weather 503 일시 실패)

### Phase 5 — P3 게시판·캐시 (완료)

- [x] board window payload cache 정합 — 알림 navigate 직전 `invalidateBoardShellCacheForNavigate`
- [x] 알림 navigate 후 선택적 refetch — `notifyBoardShellUrlChanged` 로 BoardWindowHost urlEpoch 갱신
- [x] Cloud Build 배포 v428

---

## 7. 금지·유지

| 금지 | 유지 |
|------|------|
| G7 코어 직접 수정 | REST 안전망 (`moabomShellChatSyncService`) |
| here/joining/leaving presence | revision → refetch 패턴 |
| 낙관적 presence row 혼합 | `ShellRealtimeStore` handler Set |
| Run sidecar Reverb | VM `realtime.mek360.com` |

---

## 8. 배포·검증

```bash
scripts/check-extension-autoload.sh
deploy/check-before-cloud-build.sh
# _IMAGE_TAG 증가 (cloudbuild-v3.yaml)
deploy/build-and-deploy.sh
deploy/smoke-after-deploy.sh
```

Run 컨테이너 (배포 후): `php artisan template:cache-clear` · `php artisan optimize:clear`
