# 앱 커뮤니티 (App Community) — 구현 SSOT

> **상태:** MVP + Admin 연계·Reverb revision (2026-06-28)  
> **모듈:** `moabom-apps` (초기). 규모 커지면 `moabom-app-community` 분리 검토.  
> **관련:** [GENERATED-APP-TIERS.md](./GENERATED-APP-TIERS.md), `GeneratedAppViewer`, `GeneratedAppAdminScope`

---

## 0. Admin ↔ User 연계 아키텍처 (SSOT)

### 0.1 단일 데이터 plane

| 계층 | 사용자 (moabom-basic) | 관리자 (moabom-admin_basic + layout) |
|------|----------------------|--------------------------------------|
| UI | `AppCommunityWindow` · 툴바 **앱 이야기** | `admin_app_community_posts.json` · **앱 리뷰 관리** |
| API | `/apps/generated/{id}/community/*` | `/admin/app-community/posts` |
| DB | `moabom_app_community_posts` (동일) | 동일 |
| 집계 | `moabom_system_generated_apps.community_*` | 동일 (`AppCommunityStatsService`) |
| Tenant | `AppCommunityTenantScope` | `GeneratedAppAdminScope` |

**원칙:** Admin 숨김·복구·삭제는 DB `status` 변경 + 집계 재계산만 — 사용자 API는 `published`만 노출.
리뷰는 별도 공개 범위 컬럼을 갖지 않고 대상 앱의 `visibility`를 상속한다. 즉 `global` 앱 리뷰는 전체 공개, `tenant` 앱 리뷰는 앱 소유 업체 안에서만 공개, `private` 앱 리뷰는 앱 소유자에게만 공개된다.

### 0.2 실시간 동기화 (Reverb revision)

Presence `presence.revision` 패턴과 동일 — **페이로드 최소화**, HTTP refetch SSOT.

```
Admin PATCH status / DELETE
  → AppCommunityAdminService
  → AppCommunityStatsService::recalculate()
  → AppCommunityRevisionService::bump(appId, reason)
  → Reverb public channel moabom-app-community.{appId}
  → event app_community.revision { generated_app_id, revision, reason }
  → AppCommunityWindow (useAppCommunity) silent reload
```

| 항목 | SSOT |
|------|------|
| 채널 | `AppCommunityChannelNames::revisionChannel($id)` |
| 이벤트 | `AppCommunityRevisionBroadcastEvent` |
| 캐시 revision | `moabom-app-community:revision:{id}` |
| 프론트 | `moabomAppCommunitySocket.ts` |

Broadcast 실패는 로그만 — HTTP·DB 정합성은 mutation 트랜잭션으로 보장.

### 0.3 성능

- 목록·라이브러리: `community_*` 집계 컬럼 (N+1 없음)
- 사용자 목록: `paginatePublishedForApp` + 인덱스 `(generated_app_id, created_at)`
- Admin 목록: 앱 소유 업체 필터는 `moabom_system_generated_apps` subquery로 적용 — 앱 ID 전체 `pluck()` 없음
- WebSocket: revision 정수만 — 글 본문 push 없음 (대역폭·보안)
- 세션 캐시: `appCommunitySessionCache` + revision 시 invalidate

### 0.4 용어

| 사용자 UI | Admin UI |
|-----------|----------|
| 앱 이야기 | 앱 리뷰 관리 |

### 0.5 운영 동기화 (필수)

| 산출물 | 동기화 경로 |
|--------|-------------|
| layout JSON | `moabom:saas:sync-module-layouts` (배포 Job) |
| **권한·메뉴** (`moabom-apps.community.*`) | `moabom:saas:sync-module-declarations` — `hospital-default.json` `module_sync_declarations` SSOT |

**재발 방지:** `run-layout-sync-job.sh` 가 `moabom-system`·`moabom-presence` 만 sync 하면 community admin 이 **403·빈 화면**. v376+ 에서 package SSOT 전체 sync.

---

## 1. 제품 정의

### 1.1 한 줄

**앱마다 게시판을 만들지 않고**, `generated_app_id`로 묶는 **앱 전용 이야기·리뷰 공간**.  
그누보드 `sirsoft-board`와 **분리** — 앱 수백 개 규모·별점·앱 창 UX에 맞춘 전용 plane.

### 1.2 앱 커뮤니티가 핵심인 이유

- 앱 실행만이 아니라 **의견·팁·별점**이 쌓여 “자연스러운 커뮤니티 사이트”가 됨.
- 플랫폼 홈·랭킹·검색과 연동 가능 (Phase 3+).

### 1.3 용어 (UI SSOT)

| 용어 | 사용처 | 비고 |
|------|--------|------|
| **앱 이야기** | 셸 메뉴·패널 제목 | “앱게시판” 가칭 대체. 커뮤니티 톤. |
| **앱편집** | 비소유자 편집 | **리믹스** 라벨 사용 금지 — 한국 사용자 익숙도. |
| **앱 등록** | 소유자 공개 | 기존 `share` / visibility publish. |
| **앱 삭제** | 소유자 | 기존 `destroy`. |

### 1.4 툴바 메뉴 (GeneratedAppViewer)

`permissions` 기준 (`AiAppService::serializeApp`):

| 역할 | `is_owner` | `can_edit` | 메뉴 |
|------|------------|------------|------|
| 소유자 | true | true | 앱편집 · 앱 등록/공개해제 · 앱 삭제 · **앱 이야기** |
| 비소유자 (리믹스 가능) | false | true (`edit_mode: remix`) | **앱편집** · **앱 이야기** |
| 방문자 (공개 앱 열람만) | false | false | **앱 이야기** |
| 비공개·권한 없음 | — | — | 뷰어 자체 미노출 (기존과 동일) |

- **앱 이야기**는 소유자·비소유자·방문자 모두 노출 (앱을 볼 수 있는 사람).
- 기존 `can_share` / `can_delete` 분기 유지.

---

## 2. sirsoft-board 를 쓰지 않는 이유

| 항목 | sirsoft-board | 앱 커뮤니티 요구 |
|------|---------------|------------------|
| 스코프 키 | `board_id` (파티션) | `generated_app_id` |
| 앱 수백 개 | board·파티션마다 관리 부담 | **테이블 1개 + 인덱스** |
| 카테고리 | 게시판 JSON 배열 (수동 분류) | 앱 ID가 곧 구분자 — **카테고리 무한 증가 불필요** |
| 별점 | 없음 | 글마다 1~5점 + 앱 평균 |
| UI | 별도 게시판 창 | **앱 iframe 옆/아래 패널** |
| 권한 | 게시판 RBAC | 앱 visibility + 작성자/소유자/관리자 |

**결론:** 게시판 엔진 재사용 ❌. `moabom-apps` 내 전용 테이블·API·관리 화면 ✅.

---

## 3. 관리자 plane (필수)

`sirsoft-board`의 `admin_board_posts_index`와 **동일 역할**을 moabom-apps가 담당.

### 3.1 관리 화면 2계층

| 화면 | URL (admin) | 용도 |
|------|-------------|------|
| **앱 이야기 전체 목록** | `/admin/apps/community/posts` | 플랫폼·업체 admin — 앱명·작성자·별점·상태 필터, 블라인드·삭제 |
| **앱 상세에서 바로가기** | 생성앱 관리 목록 행 액션 → 해당 앱 글만 필터 | `admin_generated_apps` 연동 |

### 3.2 설계 원칙 (생성앱 admin 과 동일)

- **API·서비스·layout 1벌**, `GeneratedAppAdminScope`로 platform/tenant 스코프만 분기.
- Host: 마스터 = 전체, 업체 = `tenant_slug` 고정.
- 권한: `moabom-apps.community.read` / `moabom-apps.community.manage`.

### 3.3 소유자(회원) 중간 권한 (Phase 2)

- 앱 소유자는 **자기 앱 글만** 숨김 처리 (관리자 plane 아님, 사용자 API `PATCH .../hide`).
- MVP는 작성자 본인 삭제 + admin 전역 관리만.

---

## 4. 데이터 모델

### 4.1 연결 (connection)

- `GeneratedAppsConnection` 과 **동일 connection** (`moabom_platform` SaaS / 기본 DB).
- 테이블명: `moabom_app_community_posts` (tenant 단일 DB에도 동일 이름).

### 4.2 `moabom_app_community_posts`

```sql
-- 개념 스키마 (마이그레이션 작성 시 idempotent 가드)
CREATE TABLE moabom_app_community_posts (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  generated_app_id BIGINT UNSIGNED NOT NULL,
  tenant_slug     VARCHAR(64) NOT NULL DEFAULT 'default',
  user_id         BIGINT UNSIGNED NOT NULL,
  post_type       VARCHAR(16) NOT NULL DEFAULT 'review',  -- review | talk (MVP: review 만)
  rating          TINYINT UNSIGNED NULL,                   -- 1-5, review 시 NOT NULL
  title           VARCHAR(120) NOT NULL,
  body            TEXT NOT NULL,
  status          VARCHAR(16) NOT NULL DEFAULT 'published', -- published | hidden | deleted
  hidden_reason   VARCHAR(32) NULL,                        -- admin | owner | report (Phase 2)
  comments_count  INT UNSIGNED NOT NULL DEFAULT 0,
  created_at      TIMESTAMP,
  updated_at      TIMESTAMP,
  deleted_at      TIMESTAMP NULL,

  INDEX idx_app_created (generated_app_id, created_at DESC),
  INDEX idx_tenant_app (tenant_slug, generated_app_id),
  INDEX idx_user_app (user_id, generated_app_id),
  INDEX idx_status (status)
);
```

**MVP 규칙**

- `post_type = review` 만 허용. `rating` 1~5 **필수**.
- **앱당 사용자 1리뷰:** `(generated_app_id, user_id, post_type)` 에 unique (soft delete 제외 시 partial unique는 앱 계층 검증).
- `talk` 타입·댓글 테이블은 **Phase 2**.

### 4.3 앱 집계 캐시 (`moabom_system_generated_apps` 컬럼 추가)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `community_rating_avg` | DECIMAL(3,2) NULL | published review 평균 |
| `community_rating_count` | INT UNSIGNED DEFAULT 0 | 평점 있는 글 수 |
| `community_post_count` | INT UNSIGNED DEFAULT 0 | published 글 수 |

- 글 생성·수정·삭제·상태 변경 시 `AppCommunityStatsService::recalculate(appId)` 호출.
- 목록·그리드·뷰어 헤더에서 N+1 방지.

### 4.4 앱 삭제 시

- `GeneratedAppPurgeService` 에서 해당 `generated_app_id` 글 **hard delete** 또는 cascade.
- 집계 컬럼은 앱 row 삭제와 함께 제거.

---

## 5. API 계약

Base: `/api/modules/moabom-apps`  
인증: 사용자 API `auth:sanctum`, admin `auth:sanctum` + `admin` + permission.

### 5.1 사용자 API — 앱 이야기

앱 열람 가능 여부는 `GeneratedAppPublishPolicy::viewerCanSeePublished` + 소유자와 동일 규칙 재사용.

| Method | Path | 설명 |
|--------|------|------|
| GET | `apps/generated/{id}/community/summary` | 평균별점·글 수·내 리뷰 유무 |
| GET | `apps/generated/{id}/community/posts` | 목록 `?page=&per_page=20` |
| GET | `apps/generated/{id}/community/posts/{postId}` | 단건 |
| POST | `apps/generated/{id}/community/posts` | 리뷰 작성 |
| PUT | `apps/generated/{id}/community/posts/{postId}` | 본인 수정 |
| DELETE | `apps/generated/{id}/community/posts/{postId}` | 본인 삭제 (soft) |

**POST body (MVP)**

```json
{
  "title": "다이어트 기록에 딱이에요",
  "body": "매일 입력하기 편하고 UI가 깔끔합니다.",
  "rating": 5
}
```

**목록 item**

```json
{
  "id": 42,
  "generated_app_id": 7,
  "post_type": "review",
  "rating": 5,
  "title": "...",
  "body": "...",
  "author": { "id": 3, "nickname": "홍길동" },
  "is_mine": false,
  "created_at": "2026-06-27T12:00:00Z"
}
```

**summary**

```json
{
  "rating_avg": 4.25,
  "rating_count": 128,
  "post_count": 128,
  "my_review": { "id": 42, "rating": 5 } 
}
```

`show` 응답의 `permissions` 확장:

```json
"permissions": {
  "is_owner": false,
  "can_edit": true,
  "edit_mode": "remix",
  "can_community_read": true,
  "can_community_write": true
}
```

- `can_community_write`: 로그인 + 앱 열람 가능 + (공개 앱 또는 소유자).
- 비로그인: `can_community_read`만 true (목록 읽기), write false.

### 5.2 Admin API

`GeneratedAppAdminScope` 적용. 쿼리에 `tenant_slug` 강제 (tenant host).

| Method | Path | permission |
|--------|------|------------|
| GET | `admin/app-community/posts` | `moabom-apps.community.read` |
| GET | `admin/app-community/posts/{id}` | read |
| PATCH | `admin/app-community/posts/{id}/status` | `moabom-apps.community.manage` |
| DELETE | `admin/app-community/posts/{id}` | manage |

**목록 필터:** `generated_app_id`, `tenant_slug`(앱 소유 업체), `author_tenant_slug`(작성자 업체), `user_id`, `status`, `rating`, `q` (제목·본문), `created_from`, `created_to`.

> **SSOT (0.4.0+):** platform admin 의 `tenant_slug` 는 생성앱 admin 과 동일하게 **앱 소유 tenant** 를 필터한다. 작성자 tenant 는 `author_tenant_slug` 를 사용한다.
> tenant host admin 에서는 요청 query 의 `tenant_slug`를 신뢰하지 않고 Host 에서 해석한 앱 소유 업체 slug로 고정한다. 응답 `meta.applied_filters`와 `meta.filter_semantics`는 운영 중 빈 목록 원인을 확인하는 추적 정보다.

**PATCH body**

```json
{ "status": "hidden", "hidden_reason": "admin" }
```

---

## 6. 권한 (module.php)

`generated` 카테고리 옆 **새 카테고리 `community`**:

| action | type | roles | 용도 |
|--------|------|-------|------|
| `read` | admin | admin | 목록·상세 |
| `manage` | admin | admin | 블라인드·삭제 |

식별자: `moabom-apps.community.read`, `moabom-apps.community.manage`.

---

## 7. Admin UI (layout JSON)

### 7.1 파일 (신규)

| 파일 | 역할 |
|------|------|
| `resources/layouts/admin/admin_app_community_posts.json` | 전체 글 목록 (sirsoft `admin_board_posts_index` 패턴) |
| `resources/routes/admin.json` | path `*/admin/apps/community/posts` |
| `src/Extension/MoabomAppsAdminMenus.php` | 메뉴 항목 추가 |
| `resources/lang/ko.json`, `en.json` | admin·messages 키 |

### 7.2 메뉴

```php
[
    'name' => ['ko' => '앱 이야기 관리', 'en' => 'App Community Posts'],
    'slug' => 'moabom-apps-community',
    'parent_slug' => 'platform-settings', // 또는 moabom-apps-generated 형제
    'url' => '/admin/apps/community/posts',
    'icon' => 'fas fa-comments',
    'order' => 51,
    'permission' => 'moabom-apps.community.read',
]
```

### 7.3 목록 컬럼

앱 ID · 앱 제목 · 작성자 · 별점 · 제목 · 상태 · 작성일 · 관리(숨김/삭제)

### 7.4 생성앱 관리 연동

`admin_generated_apps.json` 행 액션: **이야기 보기** → `/admin/apps/community/posts?generated_app_id={id}`

---

## 8. 셸 UI (moabom-basic)

### 8.1 진입

`GeneratedAppViewer.tsx` 툴바 `generated-app-action-menu`에 버튼 추가:

```tsx
// canCommunityRead — 로그인 여부와 무관하게 앱 볼 수 있으면 true
<Button className="generated-app-action-button is-community" onClick={openAppCommunity}>
  <Icon name="comments" />
  <Span>{t('moa_apps_ai.community.open')}</Span>  {/* 앱 이야기 */}
</Button>
```

i18n: `moa_apps_ai.community.open` = "앱 이야기"

### 8.2 표시 방식 (MVP 채택)

**별도 셸 창** `app-community-{serverId}` — `BoardWindowHost` / `Moa_UserProfileWindowHost` 패턴.

이유:

- iframe 높이·반응형 이슈 재발 방지 (과거 viewport flex 롤백 교훈).
- 구현 속도: 창 컴포넌트 + API 훅만 추가.
- Phase 2에서 앱 창 내 split 패널 옵션 검토.

### 8.3 신규 프론트 파일

| 파일 | 역할 |
|------|------|
| `src/apps/app-community/AppCommunityWindow.tsx` | 목록·작성·상세 |
| `src/apps/app-community/useAppCommunity.ts` | API 훅 |
| `src/api/moabomAppCommunityApi.ts` | fetch 래퍼 |
| `src/pages/home/useMoaShellWindows.ts` | `openAppCommunityWindow(serverId)` |
| `src/styles/moa-home/41-app-community.css` | 별점·목록 (기존 glass/button 재사용) |

### 8.4 창 UI (MVP)

1. **헤더:** 앱 제목 + `★ 4.2 (128)`  
2. **목록:** 카드 (별점·제목·요약·작성자·날짜)  
3. **FAB / 상단 버튼:** 리뷰 쓰기 (이미 쓴 경우 수정으로 전환)  
4. **작성 폼:** 별점 5클릭 · 제목 · 본문

### 8.5 앱 카드 별점 (Phase 1.5)

`Moa_AppCard` / 라이브러리 API에 `community_rating_avg` 노출 시 ★ 표시.

---

## 9. 백엔드 파일 체크리스트 (구현 순서)

### Phase 1 — MVP (다음 채팅 1차 목표)

1. **Migration**  
   - `database/migrations/platform/2026_06_28_000001_create_app_community_posts_table.php`  
   - `database/migrations/platform/2026_06_28_000002_add_community_stats_to_generated_apps.php`  
   - tenant fallback migration (non-platform)

2. **Model** `Models/AppCommunityPost.php`

3. **Repository** `Repositories/AppCommunityPostRepository.php`

4. **Services**  
   - `AppCommunityService` — CRUD·정책  
   - `AppCommunityStatsService` — 집계  
   - `AppCommunityAdminService` — admin 목록·상태

5. **HTTP**  
   - `Http/Controllers/AppCommunityController.php`  
   - `Http/Controllers/Admin/AppCommunityAdminController.php`  
   - `Http/Requests/StoreAppCommunityPostRequest.php` 등

6. **Routes** `src/routes/api.php` 확장

7. **Permissions** `module.php` + `getDynamicTables()` 에 테이블 추가

8. **Admin layout** JSON + routes + menus

9. **Tests**  
   - `tests/Feature/AppCommunityControllerTest.php`  
   - `tests/Feature/AppCommunityAdminControllerTest.php`  
   - `tests/Unit/AppCommunityStatsServiceTest.php`

10. **Frontend** Phase 1 창 + 툴바 버튼

11. **CHANGELOG** `moabom-apps`, `moabom-basic`

### Phase 2

- `post_type: talk` (별점 없는 질문/팁)
- 댓글 `moabom_app_community_comments`
- 소유자 hide API
- 신고 (`moabom-system` 알림 연동)

### Phase 3

- 플랫폼 홈 피드: 최근 이야기 · 높은 별점 앱
- global-search 앱 이야기 색인

---

## 10. 비즈니스 규칙 요약

| 규칙 | MVP |
|------|-----|
| 글 쓰기 | 로그인 필수 |
| 앱당 1인 1리뷰 | 예 (수정은 PUT) |
| 별점 | 1~5 정수, review 필수 |
| 비공개 앱 | 소유자만 읽기/쓰기 |
| 업체 공개 앱 | 같은 앱 소유 업체 사용자만 읽기, 로그인 사용자 쓰기 |
| 전체 공개 앱 | 모든 업체에서 읽기, 로그인 사용자 쓰기 |
| 삭제 | 작성자 soft delete; admin hard/hidden |
| 앱 삭제 | 글 cascade purge |

---

## 11. 다음 채팅 구현 프롬프트 (복붙용)

```
APP-COMMUNITY-ARCHITECTURE.md SSOT대로 moabom-apps 앱 커뮤니티 MVP 구현.

순서:
1) migration + model + repository + AppCommunityService/StatsService
2) user API + admin API + permissions + routes
3) admin_app_community_posts.json + admin 메뉴
4) moabom-basic: GeneratedAppViewer 툴바 "앱 이야기", AppCommunityWindow, API 훅
5) Feature/Unit tests

UI: 비소유자 편집 라벨은 "앱편집" 유지. 커뮤니티 창은 별도 셸 창.
배포는 하지 말 것.
```

---

## 12. 의사결정 로그

| 질문 | 결정 |
|------|------|
| 게시판 per app? | ❌ — `generated_app_id` 단일 테이블 |
| 카테고리 자동 증가? | ❌ — 불필요 |
| sirsoft-board 재사용? | ❌ |
| 관리자 글 목록? | ✅ — admin layout 필수 |
| 커뮤니티 UI | MVP = 별도 셸 창 |
| 메뉴 이름 | **앱 이야기** |
| 비소유자 편집 라벨 | **앱편집** (리믹스 표기 안 함) |
