# AI 생성앱 2티어 — 구현 SSOT

> 구현·마이그레이션·배포는 본 문서 기준.

---

## 1. 제품 정의

| 티어 | UI 이름 | 백엔드 |
|------|---------|--------|
| **Standard** | 일반 웹앱 | HTML만. 해시·탭·단일 페이지 네비 |
| **Hosted** | 고급(연결·데이터) 앱 | HTML + 서버 row + (선택) GCS |

- **앱 유형** (`general` / `3d` / `game` / `dataviz`) = 콘텐츠 종류
- **티어** (`standard` / `hosted`) = 백엔드 깊이. 독립 축

---

## 2. 확정 Host·URL

### Standard — 일반 웹앱

```
셸:   https://{tenant}.mek360.com/app/generated-app-{id}
iframe: https://apps.mek360.com/g/{id}[?preview_token=…]
```

- cross-origin 프리뷰 → `#stages` 등 URL 해시 동작
- iframe: `sandbox="allow-scripts allow-same-origin"`
- 권한: `is_shared` → 무토큰 / 비공개 → `preview_token` (`tenant_slug` 스코프)

### Hosted — 고급 앱

```
iframe: https://{id}.apps.mek360.com/[?preview_token=…]
API:    https://{id}.apps.mek360.com/api/data/{table_key}
```

- 앱 id마다 오리진 → localStorage·fetch 격리
- 데이터 쓰기: 공유 앱도 `preview_token` 또는 Sanctum 필수

### SaaS에서 금지

| Host | 이유 |
|------|------|
| `app.mek360.com` | slug `app` → 업체 tenant와 혼동 (`platform_hosts`로 완화 가능하나 **채택 안 함**) |
| `app{id}.mek360.com` | slug `app43` 등 → 업체 tenant 충돌 |
| `tenant_path` (`{hospital}/modules/.../preview/...`) | 셸과 동일 Host → 오리진 분리·해시 의도 불충족. **장기 SSOT 아님** |
| `aa.00.mek360.com` 등 | tenant 비충돌이나 TLS(`*.mek360.com` 미커버)·가독성 불리 |

---

## 3. 업체 SaaS와 Host 분리

`TenantHostParser` (`moabom-system`):

| 규칙 | 결과 |
|------|------|
| `platform_hosts` 목록 | **platform** |
| `{한 단어}.mek360.com` + `[a-z0-9-]+` | **업체 tenant** (`smoke.mek360.com`) |
| 서브도메인에 `.` 포함 | **unknown** (tenant 아님) |

| Host | 파서 | 채택 |
|------|------|------|
| `apps.mek360.com` | platform_hosts 등록 → **platform** | Standard ✅ |
| `43.apps.mek360.com` | **unknown** → 전용 `GeneratedAppHostParser` | Hosted ✅ |
| `smoke.mek360.com` | tenant `smoke` | 업체 셸 (기존) |

**TLS**

- `apps.mek360.com` — `*.mek360.com` 또는 개별 인증서
- `{id}.apps.mek360.com` — **`*.apps.mek360.com` 와일드카드** (2단계 서브도메인)

---

## 4. DB·GCS

앱마다 물리 DB·테이블 CREATE **하지 않음**.

### 데이터 plane (3계층)

운영 SSOT: **앱·Hosted row = moabom-platform**, **회원·AI 세션 = tenant DB**.

```
[moabom-platform]
  moabom_system_generated_apps   id, tenant_slug, user_id, tier, html, visibility, …
  moabom_generated_app_rows      generated_app_id, tenant_slug, user_id, table_key, payload

[tenant DB — 업체별]
  users
  moabom_ai_generation_sessions   user_id, generated_app_id → platform 앱 ID (논리 참조, FK 없음)
```

| 저장소 | 테이블 | 격리 키 |
|--------|--------|---------|
| platform | `moabom_system_generated_apps` | `tenant_slug` + `user_id` + `visibility` |
| platform | `moabom_generated_app_rows` | `generated_app_id` + `tenant_slug` + `user_id` |
| tenant | `users` | 업체별 독립 ID 공간 |
| tenant | `moabom_ai_generation_sessions` | `user_id` · `generated_app_id`는 platform ID |

> **레거시:** tenant DB 에도 `moabom_system_generated_apps` 가 baseline 으로 남아 있을 수 있음(이관 전·신규 업체).  
> **쓰기 SSOT** 는 platform (`GeneratedAppsConnection::usesPlatformStore()`).  
> `findLegacyTenantRow` 는 이관 과도기 dual-read 용 — Phase H 에서 제거 예정.

| visibility | 의미 | 회원 API | admin API |
|------------|------|----------|-----------|
| `private` | 소유자만 | ✅ 설정 | ✅ |
| `tenant` | 생성 업체 내 등록 | ✅ 설정 (「앱 등록」) | ✅ |
| `global` | 전체 테넌트 공개 | ❌ **금지** | ✅ |

| 질문 | 답 |
|------|-----|
| 앱 데이터 격리? | Hosted row: `tenant_slug` + `user_id` · Standard: `__MOABOM_APP_RUNTIME__.storagePrefix` |
| 앱 HTML 공개? | `visibility` + Host tenant_slug (`GeneratedAppPublishPolicy`) |
| 데이터 API? | `preview_token` 필수 (개인 데이터) |
| 소유 앱 목록 스코프? | `tenantScopeKey()` — `unknown` 이면 **0건** (fail-closed) |

### GCS (Hosted)

- prefix SSOT: `generated-apps/{app_id}/` (`GeneratedAppHostingService`)
- 테넌트 GCS prefix와 분리 · 앱 ID 전역 유일 전제

---

## 5. 요청 흐름

```
[업체 셸 smoke.mek360.com]
  │ API 생성·저장 → apps DB (tenant_slug=smoke)
  │ preview_url: https://apps.mek360.com/g/{id}?token=…
  └─ iframe → apps.mek360.com (HTML, frame-ancestors)

[Hosted tier=hosted]
  │ provision → 43.apps.mek360.com
  └─ iframe → HTML + /api/data/{table_key}
```

| Host | 부트스트랩 |
|------|------------|
| `smoke.mek360.com` | tenant DB (기존) |
| `apps.mek360.com` | platform + apps DB |
| `43.apps.mek360.com` | platform + apps DB, `generated_app_id=43` |

---

## 6. AI·HTML 정책

### Standard (`apps.mek360.com`)

- `href="#section-id"` 만. `<base>`, `/app/…`, full URL, SW, manifest 금지
- `localStorage` 비권장 (공용 오리진 — 필요 시 `ga{id}.` prefix)

### Hosted (`{id}.apps.mek360.com`)

- Standard 규칙 + `fetch('/api/data/{table_key}')`
- storage 키: `ga{id}.` prefix

### 공통

- 저장 시 제거: `<base>`, manifest, shim
- 서빙 시: CSP meta + HTTP `frame-ancestors` (셸 Host만)

---

## 7. 셸 (moabom-basic)

| 영역 | 동작 |
|------|------|
| `GeneratedAppViewer` | `src={preview_url}` (API tier별 URL) |
| AI 생성기 | 티어: 일반 웹앱 / 연결·데이터 앱 |
| 생성 중 미리보기 | `srcdoc` (저장 전) |
| 셸 URL | `/app/generated-app-{id}` 유지 |

---

## 8. 인프라·보안 체크리스트

- [ ] DNS: `apps.mek360.com`, `*.apps.mek360.com` → LB/Cloud Run
- [ ] TLS: `*.apps.mek360.com`
- [ ] `apps.mek360.com` ∈ `MOABOM_SAAS_PLATFORM_HOSTS`
- [ ] `GeneratedAppHostParser`: `^(\d+)\.apps\.{base}$` → Hosted
- [ ] Hosted data 쓰기 — 토큰 필수
- [ ] `preview_token`에 `tenant_slug` 스코프
- [ ] 삭제 시 row + GCS prefix 정리

---

## 9. 관리자 plane (마스터 · 업체)

> **상태: 구현 반영 (Phase G)**  
> 탈퇴 회원 앱은 **자동 삭제하지 않음**. 미등록(`private`)은 회원 편집 불가 → 관리자가 공개 범위만 올려 활성화.

### 9.1 제품 합의

| 주체 | 회원(셸) | 마스터 admin | 업체 admin |
|------|----------|--------------|------------|
| 등록·공개 앱 + 탈퇴 소유자 | 리믹스 → **내 앱으로 새로 저장** | 목록·공개·삭제 | 동일 (본원 앱만) |
| 미등록(`private`) + 탈퇴 | 편집 불가 (정상) | 공개 범위 변경 가능 | 동일 |
| 위임·담당자 지정 | — | **없음** | **없음** |
| HTML 편집 | AI 생성기 | **없음** (메타·미리보기만) | **없음** |

### 9.2 설계 원칙 — 표면은 하나, 스코프만 Host 로 갈림

운영·유지보수 SSOT: **화면 1벌 · API 계약 1벌 · 서비스 1벌**.  
마스터/업체 차이는 **“어디까지 보이나”(scope)** 뿐이며, 업체 화면은 마스터 목록에 `tenant_slug` 필터를 고정한 것과 동일하다.

| 계층 | 채택 | 비채택 (복잡도만 증가) |
|------|------|------------------------|
| **Domain** | `GeneratedAppAdminService` · `GeneratedAppPurgeService` · `GeneratedAppAdminScope` 각 1개 | 마스터/업체 서비스 이중 구현 |
| **HTTP** | 컨트롤러 1개, 라우트 prefix 1개 | prefix·컨트롤러·Request DTO 2벌 |
| **Admin UI** | layout JSON **1개** (`admin_generated_apps`) | layout 2벌 |
| **보안** | Host → scope 해석 후 쿼리·변경 강제 (§9.4) | 클라이언트 `tenant_slug` 신뢰 |

**라우트를 2개로 나누지 않는 이유:** 업체 API는 마스터 API + `tenant_slug={현재}` 와 동일. prefix 를 쪼개면 스모크·문서·layout endpoint 가 2배가 된다.

**Host 별 URL 은 2개 유지 (라우팅 제약만):**

| | 마스터 | 업체 |
|--|--------|------|
| Admin SPA | `/admin/apps/generated` | `/admin/apps/generated` (동일 path) |
| Admin API | `/api/modules/moabom-apps/admin/generated-apps` | 동일 |
| 메뉴 | top-level 「AI 생성앱」 | top-level 「AI 생성앱」 |

> `admin/saas/*` 는 테넌트 Host 에서 404 (`RestrictTenantHostPlatformAdminRoutes`).  
> 생성앱 관리는 **`/admin/apps/…`** 로 마스터·업체 **공통** — `saas` 하위에 두지 않는다.

### 9.3 요청 흐름 (통합)

```
[admin_generated_apps.json]  ← layout 1개
        │  GET/PATCH/DELETE
        ▼
GeneratedAppAdminController   ← 컨트롤러 1개
        │  scope = GeneratedAppAdminScope::fromRequest()
        ▼
GeneratedAppAdminService      ← list / show / setVisibility
GeneratedAppPurgeService      ← purge (삭제 SSOT)
        │
        ▼
moabom-platform (apps + rows) + tenant DB sessions + GCS
```

List 응답 `meta` (UI 분기용):

```json
{
  "scope": "platform" | "tenant",
  "tenant_slug": null | "mosan",
  "abilities": {
    "show_tenant_column": true,
    "filter_tenant_slug": true
  }
}
```

- **platform:** `show_tenant_column` · `filter_tenant_slug` = true  
- **tenant:** 둘 다 false (서버가 slug 고정, UI 에서 컬럼·필터 숨김)

### 9.4 Scope SSOT (`GeneratedAppAdminScope`)

Host 파싱은 `TenantHostParser` / `TenantContext` 와 동일 SSOT.

| Host | `scope` | 목록 쿼리 | `PATCH`/`DELETE` |
|------|---------|-----------|------------------|
| `mek360.com` (platform) | `platform` | 전 테넌트 · `?tenant_slug=` 선택 필터 | 앱 존재만 검증 |
| `{slug}.mek360.com` | `tenant` | `WHERE tenant_slug = {slug}` **강제** | 앱 `tenant_slug` 불일치 → **404** |

**테넌트 Host 에서 `?tenant_slug=` 쿼리는 무시** (다른 업체 열람·변경 사고 방지).

```php
// 의사 코드 — 유일한 스코프 분기 지점
GeneratedAppAdminScope::fromRequest():
  platform host → Platform(all)
  tenant host   → Tenant(lockedSlug)
```

### 9.5 API 계약

**Prefix:** `/api/modules/moabom-apps/admin/generated-apps`  
**Middleware:** `auth:sanctum` · `admin` · `permission:admin,moabom-apps.generated.*`  
(별도 `RequireMoabomPlatformHost` 없음 — scope 가 테넌트 Host 를 이미 제한)

| permission | 용도 |
|------------|------|
| `moabom-apps.generated.read` | 목록·단건 |
| `moabom-apps.generated.manage` | visibility · 완전 삭제 |

| Method | Path | 역할 |
|--------|------|------|
| `GET` | `/` | 목록 (HTML 제외) + `meta.abilities` |
| `GET` | `/{id}` | 단건 메타 |
| `PATCH` | `/{id}/visibility` | `private` \| `tenant` \| `global` |
| `DELETE` | `/{id}` | 완전 삭제 |

**목록 item:** `id`, `title`, `tenant_slug`, `tier`, `visibility`, `owner` (`user_id`, `nickname`, `status`), `parent_app_id`, `created_at`, `updated_at`, `preview_url`

**필터:** `visibility`, `tier`, `owner_withdrawn`, `q` — 공통  
**추가 필터 (platform scope 만):** `tenant_slug`

`visibility` 변경 시 `tenant_slug` 는 **불변**. `is_shared` 는 `GeneratedAppPublishPolicy::syncLegacySharedFlag`.

### 9.6 완전 삭제 SSOT (`GeneratedAppPurgeService`)

마스터·업체 admin 공용. 호출 전 `scope->assertCanManage($app)` 만 수행.

```
1. scope 검증 (tenant: tenant_slug 일치)
2. teardownHosted(app)  → rows 전부 + GCS generated-apps/{id}/
3. purgeTenantSessions  → app.tenant_slug tenant DB sessions
4. purgeTenantLegacyStore → tenant DB moabom_system_generated_apps (과거 baseline 잔여 행)
5. delete(platform app row)
```

| 항목 | 정책 |
|------|------|
| Hosted row | `generated_app_id` 기준 전부 |
| 리믹스 자식 | **삭제 안 함** |
| 탈퇴 훅 | **없음** |

### 9.7 코드 배치 (`moabom-apps`)

```
src/
  Http/Controllers/Admin/GeneratedAppAdminController.php   # 단일
  Http/Requests/Admin/UpdateGeneratedAppVisibilityRequest.php
  Services/GeneratedAppAdminService.php
  Services/GeneratedAppPurgeService.php
  Support/GeneratedAppAdminScope.php
  Support/GeneratedAppOwnerSnapshot.php
  Extension/MoabomAppsAdminMenus.php   # Host 무관 동일 url·slug
resources/
  routes/admin.json                    # */admin/apps/generated → layout 1개
  layouts/admin/admin_generated_apps.json
  lang/ko.json, en.json
```

**메뉴** (`MoabomAppsAdminMenus` — 마스터·업체 동일 선언, sync 시 Host 별 reconcile):

| slug | url | permission | order |
|------|-----|------------|-------|
| `moabom-apps-generated` | `/admin/apps/generated` | `moabom-apps.generated.read` | 3 (마스터: 업체 관리 다음) |

`TenantAdminMenuPolicy::FORBIDDEN_SLUGS` 에 **포함하지 않음**.

### 9.8 구현 순서 (Phase G)

1. ✅ `GeneratedAppAdminScope` + `GeneratedAppPurgeService` + 단위 테스트  
2. ✅ `GeneratedAppAdminService` + `GeneratedAppAdminController` + Feature (platform·tenant Host)  
3. ✅ `admin_generated_apps.json` 1종 + `meta.abilities` 분기 + i18n  
4. ⏳ Cloud Build 배포 (사용자 요청 시)

### 9.9 의도적으로 하지 않는 것

- admin HTML·AI 편집  
- 탈퇴 자동 삭제·담당자 위임  
- 리믹스 자식 연쇄 삭제  
- layout·서비스·API prefix 이중화  
- 테넌트 admin 의 타 업체 앱 접근  

---

## 10. 구현 단계 (티어·Host)

| Phase | 내용 |
|-------|------|
| **A** | Host: `platform_hosts`+=`apps.mek360.com`; `GeneratedAppHostParser`; `tenant_path` 기본 해제 |
| **B** | `tenant_slug` 마이그레이션; API tenant 스코프; 프리뷰 Host → apps DB |
| **C** | Standard: `apps.mek360.com/g/{id}` + Viewer cross-origin |
| **D** | Hosted: `{id}.apps.mek360.com` provision + data API + GCS |
| **E** | tenant DB 기존 데이터 → platform 이관 (또는 dual-read) |
| **F** | 라이브러리 tier 배지, GCS upload, 스모크 |
| **G** | 관리자 plane: 통합 admin API/UI + scope (마스터·업체) | ✅ |
| **H** | Cross-DB 구조 강화: 세션 FK 제거 · scope fail-closed · dual-read 정리 | ⏳ |

---

## 11. 구현 상태

| Phase | 상태 |
|-------|------|
| **A** Host (`apps.mek360.com`, `{id}.apps`, middleware, `tenant_path` 기본 해제) | ✅ 코드 반영 |
| **B** `tenant_slug` + platform DB plane + legacy dual-read | ✅ 코드 반영 (운영: `moabom:apps:platform-migrate` 필요) |
| **C** Standard cross-origin Viewer | ✅ |
| **D** Hosted provision + data API | ✅ |
| **E** tenant DB → platform 이관 | ✅ 1회성 `moabom:apps:migrate-to-platform` (수동만, 배포 post-deploy **제외**) |
| **F** 라이브러리 tier 배지, GCS upload, 스모크 | ⏳ |
| **G** 마스터·업체 admin 생성앱 관리 | ✅ |
| **H** Cross-DB 감사 후속 (§12) | ⏳ FK 제거·fail-closed·회원 global 금지 반영, baseline 정리 잔여 |

**운영 전 필수:** DNS/TLS `apps.mek360.com`, `*.apps.mek360.com` · `MOABOM_SAAS_PLATFORM_HOSTS`에 `apps.mek360.com` · `php artisan moabom:apps:platform-migrate` · tenant DB 에 `2026_06_21_000001_drop_generated_app_fk_from_ai_sessions` 적용

---

## 12. Cross-DB 감사 · 문제 · 조치 (2026-06-20)

### 12.1 연결 구조 요약

```
{slug}.mek360.com  → tenant DB (users, sessions) + API → platform apps
apps.mek360.com    → platform apps + preview (TenantContext=platform)
{id}.apps.mek360.com → platform apps + Hosted data API
```

회원 API prefix 는 Host 공통이나, **앱 쓰기·조회 SSOT 는 platform** + `tenant_slug` 스코프.

### 12.2 발견 이슈 · 조치 매트릭스

| ID | 심각도 | 문제 | 조치 | 상태 |
|----|--------|------|------|------|
| **CD-01** | P0 | tenant 세션 `generated_app_id` FK → tenant `moabom_system_generated_apps`. platform 앱 ID 연결 시 **저장 FK 실패** | `2026_06_21_000001_drop_generated_app_fk_from_ai_sessions` · create 마이그레이션 FK 제거 · §4 3계층 문서화 | ✅ 코드 |
| **CD-02** | P0 | `tenantScopeKey()===unknown` 일 때 `scopeTenant` 필터 생략 → **cross-tenant user_id 충돌** | `whereRaw('1=0')` fail-closed · `GeneratedAppRepositoryTenantScopeTest` | ✅ 코드 |
| **CD-03** | P1 | 회원 share API 에서 `global` visibility 허용 | `ShareGeneratedAppRequest` 에서 `global` 제거 · §4 표 | ✅ 코드 |
| **CD-04** | P1 | tenant/platform **이중 plane** — `findLegacyTenantRow`, baseline tenant 앱 테이블 | 이관 완료 tenant 에서 legacy read 제거 · baseline manifest 정리 | ⏳ Phase H |
| **CD-05** | P2 | platform Host 회원 API — `tenant_slug=platform` 만 조회, 업체 앱 미노출 | 문서화(의도). 회원 API는 **업체 Host 전용** 운영 | ✅ 문서 |
| **CD-06** | P2 | `AiGenerationSession::generatedApp()` cross-DB Eloquent | FK 제거 후에도 관계 사용 금지 — repository·service 직접 조회 | ✅ 문서 |
| **CD-07** | P2 | GCS 경로 문서(`tenant_slug` 세그먼트)와 코드 불일치 | §4 prefix SSOT `generated-apps/{app_id}/` | ✅ 문서 |

### 12.3 Phase H 잔여 (배포·운영)

1. **tenant 마이그레이션** — 모든 업체 DB 에 `2026_06_21_000001_*` 실행 (post-deploy 또는 `migrate` 롤링)
2. **baseline manifest** — `moabom_system_generated_apps` / `moabom_generated_app_rows` tenant baseline 에서 제외 검토 (신규 업체 혼선 방지)
3. **`findLegacyTenantRow` 제거** — platform 이관 100% 후 dual-read 삭제
4. **스모크** — 저장 → `linkGeneratedApp` → 세션 FK 없이 성공 확인

### 12.4 정상 동작 (재확인)

- 프리뷰: `viewerCanSeePublished` + `preview_token` + `tenantScopeMatches` (업체 셸 → `apps.mek360.com`)
- Hosted data API: 공개 HTML 과 달리 **항상 token 필수**
- Admin scope: tenant Host 타 업체 PATCH/DELETE → 404
- 회원 삭제: 세션 + 앱 transaction (`AiAppController::destroy`)
- Admin purge: Hosted + GCS + tenant 세션 + platform 행 (`GeneratedAppPurgeService`)

---

*2026-06-20 — §9 Phase G 구현 · §12 Cross-DB 감사·조치*
