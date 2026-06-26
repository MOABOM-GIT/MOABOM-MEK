# Moabom Shell · Presence · Notification · Surface 아키텍처 (리팩토링 SSOT)

> **범위:** 우측 패널(접속자·친구·알림), 셸 윈도우(공개 프로필·작성글·대화·게시판·공지·마이페이지), 실시간 동기화, G7 게시판 폼(회원/비회원)  
> **원칙:** 증상 패치 금지. **단일 SSOT·단일 표면·단일 방문자 정체성·명시적 실패**만 허용.

---

## 1. 현재 구조의 근본 결함 (증상 → 원인)

| # | 증상 | 구조적 원인 |
|---|------|-------------|
| 1 | 플랫폼 0명 \| 현재 N명 | **이중 plane**(테넌트 DB vs 플랫폼 DB) + 플랫폼 mirror `try/catch` 무음 실패. summary는 플랫폼 쿼리 성공(0) + 테넌트 성공(N) 조합 |
| 2 | 로그인 후 방문자+나 2행 | **세션 키 이원화**(`X-Moabom-Presence-Key` vs Laravel `session_id` 해시) + 프론트 **낙관적 self 행** + 서버 **user_id dedupe만** 적용. guest 행 잔존 |
| 3 | 누구를 눌러도 첫 프로필 | **윈도우 모델 불일치**: `appId`/`win.id`/`userUuid`/`globalPayloadCache`/`viewPayloads`/`DynamicRenderer` key가 분리. 사용자별 창 중첩 + Host 상태 미초기화 |
| 4 | 접속자·알림 불안정 | **3중 소스** 혼재: HTTP heartbeat·polling, Reverb presence(로그인만), 낙관적 patch. 단일 이벤트 계약 없음 |
| 5 | 스키마 비효율 | `session_key` unique만으로는 **방문자→회원 승격** 표현 불가. 플랫폼 mirror가 tenant와 다른 식별자 |
| 6 | 공지 글쓰기 시 비회원 폼 | 셸 `BoardWindowHost`의 G7 `dataContext._global.currentUser` 미주입. layout 조건 `!_global.currentUser?.uuid`가 로그인에도 true |

---

## 2. 목표 아키텍처 (4 Plane)

```
┌─────────────────────────────────────────────────────────────────┐
│  Shell UI (moabom-basic)                                        │
│  RightPanel · ShellSurfaceHost · MyPage · BoardWindow           │
│  └─ ShellSurfaceController (단일 라우터)                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP + WS events
┌───────────────────────────▼─────────────────────────────────────┐
│  Shell Context Plane (프론트 SSOT)                               │
│  auth · visitorId · locale · formFactor · activeSurfaces        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────────┐
│ Tenant        │   │ Platform      │   │ Realtime Bus      │
│ Presence      │   │ Registry      │   │ (Reverb)          │
│ (tenant DB)   │   │ (platform DB) │   │                   │
└───────────────┘   └───────────────┘   └───────────────────┘
```

### 2.1 Shell Surface Controller (셸 표면 SSOT)

**하나의 컨트롤러**가 모든 셸 오버레이를 관리한다. `useMoaShellWindows`의 분산 open 함수는 **얇은 래퍼**로만 남긴다.

| Surface kind | 인스턴스 정책 | URL SSOT |
|--------------|---------------|----------|
| `profile` | **싱글톤 1개**. `subjectUuid` 변경 시 surface **remount** (`key=profile:{uuid}`) | `/users/{uuid}` |
| `profile-posts` | profile과 **동일 surface**, view 전환 | `/users/{uuid}/posts` |
| `profile-chat` | profile과 **동일 surface**, view 전환 | `/users/{uuid}/chat` |
| `board` | slug당 1개 (기존 유지) | `/board/{slug}…` |
| `mypage` | 싱글톤 1개 | `/me/{tab}` |
| `notice` | `board` surface, slug=`notice` 고정 | `/board/notice…` |

**금지**
- 사용자마다 `moa-shell-user:{uuid}` 윈도우 무한 생성
- `openX(sync, view)` 인자 순서 혼선 (typed action 객체로 통일)
- payload global cache를 surface 전환 시 **무조건 재사용**

**표준 open 액션**

```ts
type ShellSurfaceOpen =
  | { kind: 'profile'; userUuid: string; view?: 'profile' | 'posts' | 'chat'; displayName?: string }
  | { kind: 'board'; slug: string; postId?: string; mode?: 'write' | 'edit' }
  | { kind: 'mypage'; tab?: MyPageTab };
```

### 2.2 Shell Context Plane (G7 layout 주입 SSOT)

셸 윈도우에서 G7 layout JSON이 참조하는 `_global`은 **항상** `ShellContextBridge`에서 조립한다.

```ts
interface ShellLayoutContext {
  currentUser: { uuid: string; name: string; nickname?: string; avatar?: string } | null;
  visitorId: string;          // X-Moabom-Visitor-Id (구 presence client key)
  isAuthenticated: boolean;
  formFactor: 'desktop' | 'mobile';
  tenantSlug: string;
}
```

- `BoardWindowHost` / `UserProfileWindowHost` load 시 `dataContext._global`에 **반드시** `currentUser` 주입
- 게시판 비회원 폼 조건: `!_global.currentUser?.uuid` (G7 순정과 동일) — **context만 맞으면 자동 해결**

### 2.3 Visitor Identity Plane (접속자 SSOT)

**한 브라우저 = 한 visitor_id = 최대 한 active row (tenant)**

| 필드 | 용도 |
|------|------|
| `visitor_id` (UUID, 클라이언트 영속) | PK 논리 키. 헤더 `X-Moabom-Visitor-Id` |
| `user_id` (nullable) | 로그인 승격 시 설정. **같은 row 업데이트** |
| `session_key` | deprecated → `hash(tenant_slug + visitor_id)` 로 파생 (마이그레이션 호환) |
| `client_form_factor` | pc / mobile |
| `last_seen_at` | TTL 240s (interval×4) |

**승격 규칙 (로그인 시 1회)**
1. `visitor_id`로 tenant row upsert (`user_id` 설정)
2. 동일 `user_id`의 **다른 visitor_id** 행 삭제 (다중 탭 정책: 최신 visitor만 유지 — 설정 가능)
3. `user_id IS NULL` 이면서 동일 `visitor_id`인 잔여 guest 행 삭제
4. platform mirror **동일 visitor_id**로 upsert (실패 시 structured log + `mirror_ok: false` 응답)

**접속자 목록 집계**
- UI 1행 = `COALESCE(user_id, visitor_id)` 기준 dedupe
- guest 표시명: i18n `guest_display_name` (회원 행과 병존 불가)

### 2.4 Platform Aggregate Plane

| 항목 | 정책 |
|------|------|
| 저장 | `moabom_platform.moabom_presence_platform_sessions` |
| 키 | `(tenant_slug, visitor_id)` unique |
| summary | `platform_total` = platform DB count only. **fallback to tenant 금지** (불일치 시 `mirror_degraded: true` 플래그) |
| 연결 | `PlatformConnectionFactory::registerConnection()` heartbeat·summary **공통 middleware** |

### 2.5 Realtime Event Bus

단일 이벤트 vocabulary. 프론트 `ShellRealtimeStore`가 구독.

| Channel | 인가 | 이벤트 | 용도 |
|---------|------|--------|------|
| `private-user.{uuid}` | 본인 | `notification.received` | 알림 (기존) |
| `presence-tenant.{slug}` | public/presence | `presence.revision` | tenant revision 번호 bump |
| `private-user.{uuid}` | 본인 | `presence.self` | 본인 availability 변경 echo |

**`presence.revision` payload**

```json
{ "tenant_slug": "acme", "revision": 42, "reason": "heartbeat|login|logout|preference" }
```

프론트: revision 변경 시 `GET /online` + `GET /summary` **한 번만** (debounce 300ms).  
**금지:** here/joining/leaving마다 전체 refetch + 낙관적 row 혼합.

비로그인: WS presence 채널 미사용. **revision public channel** 또는 summary polling(60s)만.

---

## 3. 데이터 모델 (목표)

### 3.1 Tenant: `moabom_presence_visitors` (신규, sessions 대체)

```sql
-- tenant DB
moabom_presence_visitors (
  id BIGINT PK,
  visitor_id CHAR(36) NOT NULL,          -- 클라이언트 UUID
  user_id BIGINT NULL FK users,          -- 승격 후
  display_name VARCHAR(120),
  status_text VARCHAR(255) NULL,
  avatar VARCHAR(512) NULL,
  client_form_factor VARCHAR(16) NULL,
  availability_source ENUM('session','preference') DEFAULT 'preference',
  last_seen_at TIMESTAMP,
  UNIQUE (visitor_id),
  INDEX (user_id),
  INDEX (last_seen_at)
)
```

마이그레이션: `moabom_presence_tenant_sessions` → visitors backfill (`visitor_id` = client key 역산 불가 시 row별 신규 UUID + prune).

### 3.2 Platform: `moabom_presence_platform_visitors`

```sql
-- platform DB
moabom_presence_platform_visitors (
  id BIGINT PK,
  tenant_slug VARCHAR(64),
  visitor_id CHAR(36),
  user_uuid CHAR(36) NULL,
  display_name VARCHAR(120),
  is_authenticated BOOL,
  last_seen_at TIMESTAMP,
  UNIQUE (tenant_slug, visitor_id),
  INDEX (last_seen_at)
)
```

### 3.3 기존 `moabom_presence_user_preferences` — 유지

`user_id` SSOT. availability / subtitle / chat 수락 / avatar 표시.

---

## 4. API 계약 (목표)

### 4.1 Presence public

| Method | Path | 설명 |
|--------|------|------|
| POST | `/public/heartbeat` | body: `{ status_text?, client_form_factor? }`. Header: `X-Moabom-Visitor-Id` **필수** |
| GET | `/public/summary` | `{ platform_total, tenant_active, mirror_ok, revision, heartbeat_interval_sec }` |
| GET | `/public/online` | `{ revision, users: [...] }` — **서버 dedupe 완료** |
| GET | `/public/user/{uuid}/presence` | 공개 presence 상태 |

**Heartbeat 응답 (변경)**

```json
{
  "accepted": true,
  "visitor_id": "...",
  "revision": 41,
  "mirror_ok": true,
  "tenant_channel": "module.moabom-presence.tenant.{slug}.online"
}
```

`accepted: false` 시 422 + reason (`bot`, `schema_unavailable`, `mirror_failed`).

### 4.2 Shell boot (확장)

`GET /api/modules/moabom-system/shell-boot` (기존)에 추가:

```json
{
  "shell_context": {
    "visitor_id": null,
    "tenant_slug": "…",
    "realtime": { "presence_revision": 0 }
  }
}
```

클라이언트: boot 시 `visitor_id` 없으면 생성·저장.

---

## 5. 프론트 구조 (목표)

```
moabom-basic/src/shell/
  ShellSurfaceController.ts      # 표면 SSOT
  ShellContextBridge.ts          # G7 _global 주입
  ShellRealtimeStore.ts          # revision·notification 통합
  surfaces/
    ProfileSurfaceHost.tsx       # key={uuid}, cache partition by uuid
    BoardSurfaceHost.tsx         # BoardWindowHost 래핑 + context
```

**제거·흡수 대상**
- `openUserProfileWindow` 4positional 인자 → `shellSurfaces.open({ kind:'profile', ... })`
- `userProfileWindowPrefetch` global Map → `ProfileSurfaceCache` (uuid namespace)
- `presenceConnectSync` 낙관적 promote → revision 기반 refetch로 대체
- `MoabomPresenceProvider`의 이중 refresh → `ShellRealtimeStore` 단일 구독

---

## 6. G7 게시판(공지) 회원 폼 — 순정 정렬

G7 순정: `form_meta` API가 auth 사용자면 `author_name`/`password` 불필요. layout은 `_global.currentUser`로 분기.

**Moabom 셸 의무사항**
1. `BoardSurfaceHost` mount 시 `ShellContextBridge.inject(templateApp)`
2. `auth_mode: optional` data source에 Bearer 토큰 전달 (이미 `boardApiGet` — **global state 동기화만 추가**)
3. 댓글 partial도 동일 `!_global.currentUser?.uuid` 패턴 확인 (`partials/board/show/...`)

---

## 7. 구현 단계 (리팩토링 로드맵)

| Phase | 내용 | 모듈 | 완료 기준 |
|-------|------|------|-----------|
| **P0** | 본 문서 + `ShellSurfaceController`·`ShellContextBridge` 골격 + 인자 타입 통일 | moabom-basic | 컴파일·lint. 기존 open 래핑 |
| **P1** | Profile 싱글톤 surface + cache partition + `key={uuid}` remount | moabom-basic | 접속자 N명 프로필 전환 회귀 시나리오 |
| **P2** | `visitor_id` 스키마·heartbeat 승격·platform mirror 명시 실패 | moabom-presence | summary `mirror_ok`. guest+self 1행 |
| **P3** | `presence.revision` 채널·`ShellRealtimeStore` | moabom-presence + basic | WS bump → 1회 refetch. 폴링만 의존 제거 |
| **P4** | Board/Notice `ShellContextBridge` — 로그인 폼 | moabom-basic | notice write/comment 회원 폼 |
| **P5** | 알림·대화·친구 surface를 Controller로 흡수 | basic + presence | URL·창·패널 삼위일체 |
| **P6** | sessions 레거시 제거·platform/tenant migration 정리 | presence | 구 테이블 drop (tenant repair 후) |

**배포:** PHP·스키마 변경 시 `_IMAGE_TAG` 증가 + Cloud Build. 프론트는 Dockerfile assets 스테이지.

---

## 8. 회원/비회원/SNS/디바이스 가정 매트릭스

| 가정 | heartbeat | 접속자 목록 | 프로필 | 대화 | 알림 |
|------|-----------|-------------|--------|------|------|
| 비회원 PC | visitor_id, no user_id | guest 1행 | uuid 클릭 불가 | — | — |
| 회원 PC | visitor_id + user_id | member 1행 | surface open | chat 탭 | private WS |
| 회원 Mobile | form_factor=mobile | 아이콘 분기 | 동일 | accept_chat_requests 반영 | 동일 |
| SNS 회원 | user.uuid SSOT | 동일 | 동일 | 동일 | 동일 |
| 로그인 직후 | 승격 + guest 행 삭제 | 1행 즉시 | — | WS 재인증 epoch | 채널 재구독 |
| 로그아웃 | user_id null 처리·행 삭제 또는 guest 전환 | guest 1행 | 창 유지 정책: profile 닫기 | chat 닫기 | WS 해제 |
| 대화 거부 | — | is_reachable=false | — | chat UI disabled | — |
| 오프라인 설정 | preference offline | connect 목록 제외 | dot offline | — | — |

---

## 9. 검증 (로컬 정책 대체)

- `scripts/check-extension-autoload.sh`
- `deploy/check-before-cloud-build.sh`
- `deploy/smoke-after-deploy.sh` — presence summary, shell-boot, notice board route
- 시나리오 매니페스트(추가): `app/modules/moabom-presence/tests/scenarios/shell-presence.yaml`

---

## 10. 관련 파일 (현재 → 목표)

| 현재 | 목표 |
|------|------|
| `useMoaShellWindows.openUserProfileWindow` | `ShellSurfaceController.open` |
| `Moa_UserProfileWindowHost` | `ProfileSurfaceHost` |
| `Moa_BoardWindowHost` | `BoardSurfaceHost` + context inject |
| `PresenceHeartbeatService` | `VisitorHeartbeatService` |
| `PresenceSummaryService` | `PresenceAggregateService` (no silent catch) |
| `presenceConnectSync.ts` | 삭제 (revision store) |
| `userProfileWindowPrefetch` global cache | `ProfileSurfaceCache` per uuid |

---

*문서 버전: 2026-06-24 · 리팩토링 SSOT*
