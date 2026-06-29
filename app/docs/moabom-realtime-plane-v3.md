# Moabom Realtime Plane v3 — 실시간 아키텍처 SSOT

> **상위 문서:** [`moabom-shell-realtime-architecture.md`](./moabom-shell-realtime-architecture.md) · [`moabom-realtime-plane-v2.md`](./moabom-realtime-plane-v2.md)  
> **원칙:** 증상 패치 금지. **단일 이벤트 버스·revision SSOT·WS+REST 안전망·명시적 실패**.

---

## 1. 4 Plane 아키텍처 (현행)

```
┌──────────────────────────────────────────────────────────────────┐
│  Shell UI — RightPanel · ProfileHero · Moa_ChatPanel              │
│  ShellRealtimeStore (단일 debounce 300ms)                         │
│  moabomShellRealtimeCoordinator (private WS 구독 수명)            │
│  moabomShellChatSyncService (REST catch-up 안전망)                │
└────────────────────────────┬─────────────────────────────────────┘
                             │ HTTP + WS
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐   ┌────────────────┐   ┌─────────────────────┐
│ moabom-       │   │ moabom-chat    │   │ G7 코어 알림        │
│ presence      │   │ (대화·인박스)  │   │ notification.received│
│ revision bus  │   │ chat.inbox.*   │   │                     │
└───────────────┘   └────────────────┘   └─────────────────────┘
        │                    │
        └──────── Reverb sidecar (동일 Cloud Run 컨테이너) ─────┘
```

### 제약 (변경 금지)

- Cloud Run 플래그·인스턴스 수 — **변경하지 않음**
- G7 코어 — `HookManager::broadcast`·알림 리스너만 사용, 코어 직접 수정 최소화
- Request-based CPU 스로틀 — Reverb idle 시 WS 지연 가능 → **REST 안전망 필수 유지**

### VM 분리 (완료)

Reverb + Redis 를 전용 VM(`34.50.62.24` / `realtime.mek360.com`)으로 운영. 상세 SSOT: [`deploy/moabom-realtime-vm.md`](../../deploy/moabom-realtime-vm.md)

| 이전 | 현재 |
|------|------|
| Cloud Run sidecar `127.0.0.1:6001` | VM nginx `wss://realtime.mek360.com` |
| 인스턴스별 독립 Reverb | Redis-backed 단일 Reverb |
| 브로드캐스트 DB 큐 경유 | `ShouldBroadcastNow` 즉시 publish |

---

## 2. 이벤트 계약 (SSOT)

| 채널 | 이벤트 | 발생 | 소비 |
|------|--------|------|------|
| `module.moabom-presence.tenant.{slug}.revision` | `presence.revision` | heartbeat·login·preference·**friendship_*** | `ShellRealtimeStore` → summary+online+friends refetch |
| `core.user.notifications.{uuid}` | `notification.received` | DB 알림 발송 | 알림 패널·토스트 |
| `core.user.notifications.{uuid}` | `chat.inbox.updated` | 메시지·**member.left** | 인박스 캐시·`useMoabomChat` |
| `module.moabom-chat.tenant.{id}.conversation.{uuid}` | `message.*`·`conversation.*` | 메시지·읽음·타이핑 | 활성 대화 WS |

### revision bump reason (v3)

| reason | 트리거 |
|--------|--------|
| `heartbeat` / `login` / `logout` / `preference` | PresenceHeartbeatService |
| `friendship_requested` | FriendshipService::sendRequest |
| `friendship_accepted` | FriendshipService::acceptRequest·상호수락 |
| `friendship_removed` | FriendshipService::removeFriendship |

### 알림 타입 (moabom-presence)

| type | 훅 | 수신자 |
|------|-----|--------|
| `friend_request` | `friendship.after_request` | addressee |
| `friend_accepted` | `friendship.after_accept` | requester (trigger_user) |
| `friend_removed` | `friendship.after_remove` | trigger_user |

---

## 3. REST 안전망 (v3)

| 영역 | WS 연결 | WS 끊김 |
|------|---------|---------|
| 인박스 | 60s safety poll | 8s fast + 30s safety |
| 알림 | **60s safety poll** (v3) | 10s poll |
| 접속자 | revision WS + 60s heartbeat | heartbeat only |

WS 재연결 시 `runCatchUpSync()` — 인박스·알림 REST 1회.

---

## 4. 대화 나가기 (member.left)

1. `DELETE conversations/{uuid}` → `leaveConversation` — 본인 멤버 soft delete
2. 서버 → 남은 멤버에게 `chat.inbox.updated` (`reason: member.left`, `is_writable: false`)
3. 프론트 — composer 비활성화, `peer_left` 안내
4. 재대화 — `startConversation` → `restoreMemberIfTrashed` → 새 목록 항목

직렬화 필드:

- `members[].has_left` — soft-deleted 멤버
- `is_writable` — direct: 활성 peer 존재 시 true

---

## 5. 프로필 히어로 동기화

- `useMoaUserProfileSocialActions` — `ShellRealtimeStore` presence invalidate + `moabom-presence-friends-changed` 이중 구독
- 친구·접속 상태 — `MoabomPresenceProvider` context (revision refetch SSOT)
- presence dot — 향후 P1 `ProfileSurfaceHost` + `user_presence` datasource (로드맵)

---

## 6. 관련 파일

| 영역 | 파일 |
|------|------|
| Presence revision | `modules/moabom-presence/src/Services/PresenceRevisionService.php` |
| Friendship | `modules/moabom-presence/src/Services/FriendshipService.php` |
| Chat leave/broadcast | `modules/moabom-chat/src/Services/ChatService.php` |
| Shell store | `templates/moabom-basic/src/shell/ShellRealtimeStore.ts` |
| WS coordinator | `templates/moabom-basic/src/runtime/moabomShellRealtimeCoordinator.ts` |
| REST safety | `templates/moabom-basic/src/runtime/moabomShellChatSyncService.ts` |
| Profile social | `templates/moabom-basic/src/hooks/useMoaUserProfileSocialActions.ts` |

---

*문서 버전: 2026-06-27 · Realtime Plane v3*
