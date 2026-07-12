# 배포 시 자주 나는 오류·증상 — 재발 방지 SSOT

> **목적:** Cloud Build / Cloud Run 배포마다 우회·재시도·태그 낭비가 반복되지 않도록, **증상 → 원인 → 올바른 조치**를 한곳에 모음.  
> Tenant appearance·split-brain 등 과거 DoD 분석은 본 문서 범위 밖 — **본 문서는 배포·이미지·Job·레이아웃·인프라** 쪽.

**배포 전 필수:** `./deploy/check-before-cloud-build.sh` (내부에 `check-deploy-recurring-guards.sh` 포함)  
**배포 골든 경로:** [README.md](./README.md) · [build-and-deploy.sh](./build-and-deploy.sh)

---

## 완료 상태 — A·B vs C (2026-06-02)

**결론: C(런타임 DB 제거)를 제외하면 Moabom 배포·admin 레이아웃 RF 대응은 코드·문서·게이트 기준으로 완료.**  
운영에 반영하려면 **이 변경이 들어간 이미지로 `build-and-deploy.sh` 1회**만 하면 됩니다 (현재 repo 태그 SSOT: `v155`, 다음 배포 시 `build-and-deploy` 자동 layout sync 포함).

### A. 자동화 (우회 제거) — **완료**

| # | 항목 | 구현 위치 | 상태 |
|---|------|-----------|------|
| A1 | 배포 성공 시 layout DB sync **자동** (실패 시 배포 중단) | `build-and-deploy.sh` | ✅ |
| A2 | `--skip-layout-sync` 옵션 (디버그용만) | `build-and-deploy.sh` | ✅ |
| A3 | `--async` 시 deploy·smoke·layout sync 안내 출력 | `build-and-deploy.sh` | ✅ |
| A4 | 부팅 시 layout sync 3회 재시도, `\|\| true` 제거 | `cloudrun-entrypoint.sh` | ✅ |
| A5 | 수동 Job 래퍼 (slug `*` 금지) | `run-layout-sync-job.sh` | ✅ |
| A6 | gcloud Job args에 `*` 차단 | `lib/cloud-run-artisan-job.sh` | ✅ |

### B. G7 이중 SSOT 유지 (filesystem JSON → DB sync) — **완료**

| # | 항목 | 구현 위치 | 상태 |
|---|------|-----------|------|
| B1 | `_tab_info.json` memory `used/total/percentage` 바인딩 | `templates/moabom-admin_basic/.../_tab_info.json` | ✅ |
| B2 | `moabom:saas:sync-template-layouts` (slug optional, 검증, cache-clear) | `SaasSyncTemplateLayoutsCommand.php` | ✅ |
| B3 | sync 후 `admin_settings` 구형 `memory_usage ??` 검증 | 동일 커맨드 `LEGACY_MEMORY_SPAN_PATTERN` | ✅ |
| B4 | 신규 tenant provision 후 admin `template:refresh-layout` | `TenantProvisionArtisanRunner.php` | ✅ |
| B5 | 배포 전 정적 가드 RF-01~13 | `check-deploy-recurring-guards.sh` → `[v8-0]` | ✅ |
| B6 | Dockerfile bcmath (system-info API) | `deploy/Dockerfile` [v8-20] | ✅ |
| B7 | 운영 env: layout sync 켜짐 | `production.env.yaml` `MOABOM_SYNC_TEMPLATE_LAYOUTS` | ✅ |

### C. 런타임 DB 제거 (항상 filesystem JSON만) — **미구현·범위 외**

| | |
|---|---|
| **내용** | `template_layouts` 없이 admin이 이미지 JSON만 읽도록 G7 엔진·캐시·WYSIWYG 전면 변경 |
| **상태** | ❌ 계획 없음 — **B(동기화)로 충분** |
| **이유** | G7 upstream 계약·테넌트별 WYSIWYG 수정·layout cache와 충돌. 비용 대비 이득 없음 |

### 운영 체크 (한 번만)

| 확인 | 기대 |
|------|------|
| `./deploy/build-and-deploy.sh` (태그 1회 증가) | smoke 통과 → `Post-deploy layout DB sync` 로그 → Job `admin_settings memory 바인딩 OK` |
| freshent admin → 환경설정 → 정보 | 메모리 `used / total (N%)`, Span 오류 없음 |
| `--async`만 사용하는 경우 | deploy·smoke 후 출력된 `run-layout-sync-job.sh` **필수** (A3) |

### 아직 “다른 주제”로 남는 것 (본 문서 범위 밖)

Tenant appearance DoD-5·split-brain, moabom-system decomposition 등은 별도 설계 주제 — 배포 RF는 본 문서와 `deploy/README.md`만 SSOT.

---

## 0. STOP — 배포로 해결하면 안 되는 것

| # | 금지 | 대신 |
|---|------|------|
| D1 | 원인 모를 때 `_IMAGE_TAG`만 연속 증가 · **layout Job 실패만으로 재빌드** | 로그·게이트 통과 후 **태그 1회** · layout 만이면 [RF-24](#rf-24-layout-job-실패--전체-재배포-루프-구조) |
| D2 | `DEPLOY_SKIP_CHECK=1` + `--skip-check` 습관화 | `check-before-cloud-build.sh` 실패 원인 수정 |
| D3 | JSON/레이아웃만 고치고 DB sync 생략 | [RF-01](#rf-01-admin-정보-탭-memory_usage--react-31) |
| D4 | Cloud Run Job에 `php artisan … '*'` 전달 | slug **생략** 또는 `freshent` 등 구체 slug [RF-12](#rf-12-cloud-run-job-인자에--전달) |
| D5 | `--async` 후 `gcloud run deploy` 생략 | Build SUCCESS → deploy → smoke [RF-03](#rf-03-async-후-deploy-누락) |
| D6 | 로컬 `docker build -f deploy/Dockerfile` 로 운영 push | **Cloud Build만** [README.md](./README.md) |
| D7 | WSL 호스트에서 `cd templates/moabom-basic && npm ci`/`npm run build` | **금지** — dist 는 Cloud Build asset stage 산출물, 가드가 차단 [RF-20](#rf-20-wsl-호스트-npm-으로-moabom-basic-로컬-빌드--node_modules-파손) |
| D8 | Cloud Run **Instance-based** (`--no-cpu-throttling`) 수동 deploy | **Request-based 고정** — `deploy/lib/cloud-run-service-flags.sh` [RF-22](#rf-22-cloud-run-billing-request-based-고정) |

---

## 1. 재발 카탈로그 (RF)

### RF-01: Admin 정보 탭 `memory_usage` — React #31

| | |
|---|---|
| **증상** | `[Span] 데이터를 표시할 수 없습니다` · `object with keys {total, used, free, percentage}` |
| **원인** | DB `template_layouts`의 `admin_settings`에 `{{systemInfo?.data?.memory_usage ?? '-'}}` 잔존 (객체를 Span에 직접 렌더) |
| **착각** | “이미지에 JSON 고쳤으니 배포만 하면 됨” — **런타임은 DB 레이아웃** |
| **왜 bcmath만 됨** | bcmath = PHP/API · 메모리 = **레이아웃 JSON** |
| **조치** | ① `_tab_info.json` SSOT ② `build-and-deploy.sh` 자동 DB sync [RF-13](#rf-13-레이아웃-db-동기화-자동화됨) ③ 브라우저 강력 새로고침 |
| **예방** | [A·B 완료 표](#완료-상태--ab-vs-c-2026-06-02) · `check-moabom-admin-basic-ssot.sh` · entrypoint·provision sync |

### RF-02: `moabom:saas:sync-template-layouts` 실패 (slug 인자)

| | |
|---|---|
| **증상 A** | `The "slug" argument does not exist` (Job에 `*` 포함) |
| **증상 B** | `Not enough arguments (missing: "slug=")` (구버전 커맨드) |
| **원인** | Laravel `{slug=*}` 기본값 + gcloud `--args` CSV에서 `*` 깨짐 · v154 전후 signature 불일치 |
| **조치** | slug **인자 생략** (= platform + active tenants) 또는 `freshent` 한 건 |
| **예방** | `check-deploy-recurring-guards.sh` · `cloud-run-artisan-job.sh` 가 `*` 거부 |

```bash
# 올바름
./deploy/run-layout-sync-job.sh

# 금지
moabom_run_artisan_job … moabom:saas:sync-template-layouts '*' …
```

### RF-03: `--async` 후 deploy 누락

| | |
|---|---|
| **증상** | 빌드만 SUCCESS, 운영 URL은 구 이미지 · “고쳤는데 안 바뀜” |
| **조치** | `gcloud builds list` → SUCCESS 후 `gcloud run deploy` 또는 동기 `build-and-deploy.sh` |
| **예방** | async 사용 시 [README.md](./README.md) · build-and-deploy `--async` 안내 따르기 |

### RF-04: Cloud Build 업로드·빌드 30분+ / FAILURE

| | |
|---|---|
| **증상** | archive 8만 파일·1GiB+ · Dockerfile npm in moabom-basic |
| **원인** | `.gcloudignore` 미적용 · `_bundled`/`node_modules` 포함 · Dockerfile에 금지 빌드 단계 |
| **조치** | [v7-6][v7-4] invariant 통과 확인 · 업로드 ~2만 파일·400MiB 이하 |
| **예방** | `check-before-cloud-build.sh` |

### RF-05: 배포 직후 전 API 500

| | |
|---|---|
| **증상** | attachment·public API HTML 500 |
| **원인** | `StorageInterface` bind 누락 · entrypoint `config:cache` 후 storage root 소유 · `route:cache` |
| **조치** | [v7-2b] GCS factory · `chown www-data storage bootstrap/cache` · `route:clear` |
| **예방** | `smoke-after-deploy.sh` · attachment curl 404 json (非500) |

### RF-06: `shell-boot` / 모듈 API 404

| | |
|---|---|
| **증상** | `public/shell-boot` 404 · 분리 모듈 404 |
| **원인** | `_bundled`만 수정 · 활성 `modules/moabom-system` 미반영 · autoload 구파일 |
| **조치** | 활성 경로 수정 → `extension:update-autoload` → 재배포 |
| **예방** | [v7-2][v7-2c] · `scripts/check-extension-autoload.sh` |

### RF-07: 신규 테넌트에 구 admin 레이아웃

| | |
|---|---|
| **증상** | provision 직후만 admin UI 깨짐 |
| **원인** | `TenantPackageDatabaseSeeder`가 platform `template_layouts` **복제** · admin `template:refresh-layout` 없음 |
| **조치** | `TenantProvisionArtisanRunner`에서 `active_admin_template` refresh (v155+) |
| **예방** | provision 후 smoke · layout sync Job |

### RF-08: entrypoint layout sync 실패가 묻힘

| | |
|---|---|
| **증상** | 부팅은 성공, UI만 구버전 레이아웃 |
| **원인** | `cloudrun-entrypoint.sh` 에 `|| true` — sync 실패해도 컨테이너 기동 |
| **조치** | Cloud Run 로그 `Syncing template layouts` · 수동 `./deploy/run-layout-sync-job.sh` |
| **예방** | 배포 후 Job 1회(아래 RF-13) · 로그 알림 |

### RF-09: PHP 확장 UI “전부 끊김” 오해

| | |
|---|---|
| **증상** | 정보 탭 Span 오류 + PHP 확장 X 다수 |
| **원인** | Span 오류로 탭 신뢰도 하락 · 선택 확장(redis 등) 미설치는 정상 |
| **조치** | RF-01 해결 후 재확인 · Dockerfile `bcmath` [v8-20] |

### RF-10: WSL에 Docker 없음 — “로컬에서 배포 검증” 불가

| | |
|---|---|
| **증상** | `docker: command not found` |
| **조치** | 정적 게이트만 로컬 · 운영 검증은 Cloud Build + Job |
| **예방** | Docker Desktop WSL integration 또는 CI만 사용 |

### RF-11: 로컬 `template:build` / npm — `_bundled` 덮어쓰기

| | |
|---|---|
| **증상** | upstream 미러 파괴 · dist·이미지 불일치 |
| **조치** | 활성 경로만 수정하고 산출물은 Cloud Build asset stage 에 맡김 · 호스트 npm 금지 |
| **예방** | `moabom-operations.mdc` 프론트 빌드 표 |

### RF-20: WSL 호스트 npm 으로 moabom-basic 로컬 빌드 → node_modules 파손

| 항목 | 내용 |
|------|------|
| **증상** | `vite.config.ts` 에 `'vite-plugin-dts'`/`'workbox-build'` **모듈 또는 형식 선언을 찾을 수 없음** (원래 없던 빨간 줄) |
| **직접 원인** | WSL 호스트에서 `cd app/templates/moabom-basic && npm ci && npm run build` 실행. `npm ci` 가 node_modules 를 비운 뒤 재설치하는데 PATH 의 npm 이 **Windows npm**(`/mnt/c/Program Files/nodejs/npm`) 으로 폴백 → esbuild postinstall(`install.js`)이 **UNC 경로(`\\wsl.localhost\...`)에서 CMD 미지원으로 실패** → 재설치 중단 → `workbox-build` 의 `package.json` 누락·`vite-plugin-dts` 디렉터리 소실 |
| **근본 원인** | ① 에이전트가 골든룰("호스트/WSL `npm run build` 금지")을 어기고 이미지용 dist 를 로컬에서 빌드하려 함. 운영 산출물은 **Cloud Build asset stage** 가 생성하므로 로컬 빌드 자체가 불필요. ② WSL 에 Linux Node 부재 → npm 이 Windows 로 폴백되는 환경 풋건 |
| **착각** | "이미지용 dist 를 지금 로컬에서 만들어야 한다" — 실제 운영 이미지는 [Dockerfile](./Dockerfile) asset stage 에서 `moabom-admin_basic`·`moabom-system`·`moabom-basic` 을 모두 빌드 |
| **조치** | ① WSL 에 **Linux Node 설치**(nvm `nvm install 22` 또는 NodeSource) 후 `npm ci` 로 node_modules 복구가 필요할 수 있음 ② 로컬 빌드 시도 자체를 막는 가드 유지 ③ 운영 dist 는 Cloud Build 산출물로만 갱신 |
| **예방** | 활성 프론트 `package.json` 의 `prebuild`/`predev` 훅 — Windows npm/UNC 및 호스트/WSL 빌드 **하드 차단**. `check-deploy-recurring-guards.sh` 가 가드 wiring 상존 검증. `check-before-cloud-build.sh` 는 Dockerfile 내 Cloud Build asset stage 존재와 로컬 Dockerfile 빌드 차단 가드를 함께 검증 |

> **핵심:** moabom-basic 운영 산출물(`dist/`)은 Cloud Build asset stage 에서 만들어진다. 호스트/WSL 에서 `npm run build` 를 돌릴 이유가 없고, Windows npm 폴백 환경에서는 그 시도가 곧 node_modules 파손이다.

### RF-22: Cloud Run Billing Request-based 고정

| | |
|---|---|
| **정책** | Billing = **Request-based** (`gcloud --cpu-throttling`). 콘솔 Billing 탭과 동일 |
| **SSOT** | `deploy/lib/cloud-run-service-flags.sh` — `build-and-deploy.sh` 가 이 플래그만 사용 |
| **금지** | `--no-cpu-throttling` (Instance-based) 를 deploy 스크립트·수동 gcloud 에 넣는 것 |
| **가드** | `deploy/check-cloud-run-billing-ssot.sh` (배포 전) · 스모크 시 `MOABOM_BILLING_CHECK_LIVE=1` (운영 revision 검증) |
| **채팅** | Reverb sidecar 는 HTTP 요청 밖에서 CPU 스로틀 대상 — WS·실시간 푸시에 영향 가능. `CHAT-ARCHITECTURE.md` §5 참고 |

### RF-12: Cloud Run Job 인자에 `*` 전달

| | |
|---|---|
| **증상** | RF-02 A |
| **조치** | `deploy/lib/cloud-run-artisan-job.sh` 가 차단 (v155+ guards) |

### RF-13: 레이아웃 DB 동기화 (자동화됨)

| | |
|---|---|
| **기본** | `./deploy/build-and-deploy.sh` — **매 배포** `run-platform-module-layout-reconcile-job.sh` (platform module layouts SSOT) + layout·module JSON **해시 변경 시에만** `run-layout-sync-job.sh` |
| **강제** | `MOABOM_FORCE_LAYOUT_SYNC=1` · 전체 sync 생략은 `--skip-layout-sync` |
| **캐시** | **매 배포** `run-serving-cache-bust.sh` (서빙 file cache 분리 완화) |
| **부팅 백업** | `MOABOM_ENTRYPOINT_DEFERRED_SYNC=false`(운영) — 배포 Job SSOT |
| **수동** | `--async` 후 → reconcile Job + (manifest 변경 시) layout sync Job + serving cache bust |
| **성공 로그** | `platform module layout reconcile 완료` · `template layout sync 완료` |

> **RF-13b Platform module layouts:** `moabom:saas:reconcile-platform-module-layouts` — 전 활성 모듈의 admin/user layout JSON filesystem → platform DB 정합. override purge·orphan 단축명 제거·served content 검증. hash 게이트와 **분리**되어 manifest 미변경 배포에서도 구형 layout 고착을 방지한다.

> **SaaS module layouts:** `admin_saas_*`·`admin_mypage_settings` 는 **`moabom:saas:sync-module-layouts`** (platform + tenants). `module:refresh-layout` 단독은 RF-14b 원인 → [RF-14](#rf-14-saas-hospitals--모듈-레이아웃-db-미동기화) · [RF-14b](#rf-14b-테넌트-db에-구-tenant-settings-endpoint-잔류).

### RF-24: layout Job 실패 → 전체 재배포 루프 (구조)

| | |
|---|---|
| **증상** | reconcile/sync Job 실패 후 `_IMAGE_TAG` 올려 Cloud Build 재실행 (수 시간·태그 낭비) |
| **원인** | SoftDeletes `refresh()`/`delete` 가 Job exit 를 깨뜨림 + 이미지 배포와 layout 정합이 한 exit 에 묶여 “배포 실패 = 재빌드”로 착각 |
| **착각** | “layout 버그니까 이미지 다시 올려야 한다” — 서비스 이미지는 이미 서빙 중일 수 있음 |
| **조치** | ① reconciler SoftDeletes 계약(DB::table overwrite, 삭제 금지) ② **재빌드 없이** `IMAGE_TAG=<현재> bash deploy/run-post-deploy-layout-pipeline.sh` ③ 코드 수정이 이미지에 없으면 그때만 태그 1회 |
| **예방** | `check-module-layout-softdeletes-contract.sh` · `build-and-deploy` layout 실패 시 D1 안내 · Job image/cmd 동일 시 `jobs update` 스킵 |
| **금지** | layout Job 실패만으로 `_IMAGE_TAG` 연속 증가 (D1) |

### RF-29: 코어 `build:core` 폴백 → 구 template-engine 서빙 (관리자 영구 blur)

| | |
|---|---|
| **증상** | 관리자 DataGrid에 `opacity-50 blur-sm …` 영구 적용. 소스에 DataGate(`auto_fetch:false` progressive 제외)가 있어도 운영 미반영 |
| **원인** | (1) `Dockerfile` `npm run build:core … \|\| true` — closeBundle(`resources/js/core/lang` 부재)로 exit≠0 이어도 폴백으로 넘어가며, 산출 검증 없음 (2) admin 그리드 `blur_until_loaded: true`가 `_admin_base` deferred 키와 충돌 |
| **착각** | “layout-sync unchanged skip 때문에 DB 구 layout” — DataGate는 엔진 번들 문제. skip 후에도 `template:cache-clear`+serving bust는 실행됨 |
| **조치** | `build:core` hard-fail + 산출물에 `auto_fetch` 문자열 검증. admin 그리드는 `blur_until_loaded: { data_sources }` 스코프 |
| **예방** | `check-before-cloud-build.sh` [v7-9b] · `RUNTIME-CONTRACTS.md` DataGate |

### RF-25: nginx `upstream timed out` (셸 부트·크레딧)

| | |
|---|---|
| **증상** | 브라우저/로그에 `upstream timed out` / 504 — 셸 로드·우측 프로필 직후 자주 |
| **원인** | (1) `nginx-cloudrun.conf` PHP location 에 `fastcgi_read_timeout` 미설정 → 기본 **60s** (2) 셸이 `GET user/credits` 로 원장 SUM/COUNT/목록까지 매번 조회 |
| **착각** | “Cloud Run timeout(3600s)이 짧다” — 실제 병목은 nginx→php-fpm 기본 60s + 무거운 credits overview |
| **조치** | `fastcgi_read_timeout 120s` · 셸은 `?limit=0` 경량 경로(잔액·level만) · 마이페이지는 기존 limit≥1 |
| **예방** | `check-before-cloud-build.sh` `fastcgi_read_timeout 120s` 가드 · `CreditService::getUserCreditOverview` limit=0 분기 |

### RF-26: `*.run.app` + `X-Forwarded-Host` 테넌트 스푸핑

| | |
|---|---|
| **증상** | Cloud Run URL 직접 호출 + `X-Forwarded-Host: victim.mek360.com` 으로 타 테넌트 설정/스토리지 plane 접근 가능 |
| **원인** | `allUsers` invoker + ingress 전체 공개 + `TenantRequestHost` 가 forwarded 헤더를 무검증 우선 |
| **조치** | (1) `TenantRequestHost` — SaaS allowlist + `*.run.app` 일 때만 forwarded 채택 (2) `--ingress=internal-and-cloud-load-balancing` (LB `moabom-lb-frontend` 단일 진입) |
| **예방** | `check-moabom-refactor-invariants.sh` §9 · `check-cloud-run-billing-ssot.sh` ingress 가드 |

### RF-27: Cloud Build `package:discover` — `Target class [cache]`

| | |
|---|---|
| **증상** | Dockerfile vendor 스테이지 `php artisan package:discover` 실패 → Cloud Build FAILURE |
| **원인** | Moabom overlay `JsonConfigRepository::getCategory` 가 `Cache::remember` 호출. SettingsServiceProvider 는 CacheServiceProvider 등록 전에 실행됨 |
| **조치** | `app()->bound('cache')` 가드 · Dockerfile `G7_JSON_SETTINGS_CACHE_TTL=0` |
| **예방** | `check-core-patches.sh` / refactor invariants 에 bound 가드 문자열 검사 |

### RF-28: `Driver [gcs] is not supported` (SettingsServiceProvider register)

| | |
|---|---|
| **증상** | 배포 직후 `/public/ready` 등 전 API 500 — `Driver [gcs] is not supported` |
| **원인** | Spatie `GoogleCloudStorageServiceProvider` 는 `boot()` 에서만 `Storage::extend('gcs')`. `SettingsServiceProvider::register()` 가 그 전에 `settings` 디스크(gcs) 를 읽음 |
| **조치** | `EarlyGoogleCloudStorageServiceProvider` — `register()` + `FilesystemManager` resolving 에서 extend, `bootstrap/providers.php` 에 Settings 앞 등록 |
| **예방** | `check-core-patches.sh` Early* Provider 가드 |

### RF-29: G7 7.0.2 이후 SPA HTML 전면 500 (View Composer 시그니처)

| | |
|---|---|
| **증상** | `/` `/login` `/admin` `/boards` HTML 500 · API(`ready`, `/api/me`) 는 정상 |
| **원인** | G7 7.0.2 `UserTemplateComposer`/`TemplateComposer` 에 `TemplateManager` 추가. Moabom 래퍼가 6인자 `parent::__construct` → `ArgumentCountError`. 추가로 slim compose 가 `bundleUrls`/`templateExternals`/`extensionCacheVersion` 누락 |
| **착각** | GCS(RF-28)만 고치면 HTML도 살아남 · smoke ready 통과 = 사이트 OK |
| **조치** | `MoabomUserTemplateComposer`/`MoabomTemplateComposer` 가 `TemplateManager` 전달 + G7 SPA compose 키 채움 |
| **예방** | `check-moabom-refactor-invariants.sh` G7 SPA View Composer contract |

### RF-30: 게시판 첨부 preview 500 (GCS / Cloud Run)

| | |
|---|---|
| **증상** | 공지 등 게시글 이미지 `.../attachment/{hash}/preview` → 500 (`이미지 미리보기에 실패했습니다.`) · 목록/상세 API 는 200 |
| **원인** | `User\AttachmentController::preview` 가 `getFileInfo()` 로컬 path + `fileResponse()` 사용 — GCS 디스크에 로컬 파일 없음 |
| **착각** | G7 코어 upstream 이 목록 API 를 깨뜨림 · 셸 부트 2초 지연과 동일 원인 |
| **조치** | `AttachmentService::preview()` 스트리밍 + Cache-Control (download 과 동일 경로) |
| **예방** | Cloud Run 에서 board attachment preview curl 스모크 |

### RF-31: 공지 상세 로그인 500 — sirsoft-board schema drift

| | |
|---|---|
| **증상** | 로그인 후 공지 클릭 → axios `Request failed with status code 500` · `GET .../boards/notice/posts/{id}` 500. 비로그인·목록·navigation 은 200 |
| **원인** | `PostRepository::findWithCounts` 가 관리 권한자에게 attachments 에 `trigger_type=cascade` 조건을 쓰는데, `board_attachments.trigger_type` 컬럼 미적용 (`2026_06_26_000002_...`) |
| **재발 구조** | post-deploy migrate allowlist 가 `moabom-*` 만 → **sirsoft-board 마이그레이션이 이미지와 함께 안 돌아감**. 코드만 배포되면 관리자 상세만 500 |
| **착각** | “배포가 RF-30 preview 수정을 되돌렸다” · G7 코어 upstream 회귀 |
| **조치** | platform(+tenant) 에 sirsoft-board migrate · post-deploy extra allowlist 에 `sirsoft-board` (RF-21 확장) · `PostController::show` 예외 `Log::error` |
| **예방** | `check-deploy-recurring-guards.sh` RF-31 · 배포 후 로그인 세션/토큰으로 posts/{id} 스모크 |

### RF-14: SaaS hospitals — 모듈 레이아웃 DB 미동기화

| | |
|---|---|
| **증상** | `/admin/saas/hospitals` · `/create` 배포 후에도 **구 UI** (빈 목록·구 `$t:` 키) |
| **원인** | template sync만 실행 — `admin_saas_*`·`admin_mypage_settings` 는 **moabom-system module_layouts** |
| **착각** | “layout sync 돌렸으니 반영됐겠지” · `module:refresh-layout` 만으로 테넌트 DB까지 갱신됨 |
| **조치** | `./deploy/run-layout-sync-job.sh` 전체 (`sync-template-layouts` + **`sync-module-layouts`** + declarations + cache-clear) |
| **예방** | `saas-hospitals-admin-gate.sh` · `check-deploy-recurring-guards.sh` RF-14b |

### RF-14b: 테넌트 DB에 구 `tenant-settings` endpoint 잔류

| | |
|---|---|
| **증상** | 마이페이지 설정 `/admin/platform/settings/mypage` **빈 화면** · API 404 |
| **원인** | `module:refresh-layout` 은 **플랫폼 DB만** 갱신 — active tenant DB는 `moabom:saas:sync-module-layouts` 필요 |
| **조치** | `run-layout-sync-job.sh` · 부팅 `cloudrun-entrypoint.sh` (`MOABOM_SYNC_MODULE_LAYOUTS`, 기본 true) |
| **전환기** | 구 클라이언트: `legacy-tenant-settings-compat.php` → `admin/settings` 위임 (DB sync 후 제거 검토) |

### RF-18: Admin SPA 간헐적 **502** (Bad Gateway)

| | |
|---|---|
| **증상** | 관리자 화면 API 요청 중 `Request failed with status code 502` |
| **가능 원인** | Cloud Run 인스턴스 cold start · PHP-FPM/Artisan 타임아웃 · tenant bootstrap(DB·GCS) 지연 · 동시 다발 layout/lang API |
| **캐시 오염** | file `CACHE_STORE` + `template.language.*` 키에 tenant scope 없음 → RF-18b (`TenantScopedCacheDecorator`) |
| **조치** | Cloud Run 로그(해당 시각 requestId) · 스케일 SSOT `min-instances=0` `max-instances=10` (`cloud-run-service-flags.sh`) · 재현 시 `/api/templates/.../lang/` 200 여부 확인 |
| **예방** | v181+ `TenantScopedCacheDecorator` · layout sync Job · tenant `sync-tenant-admin-menus` |

### RF-19: 테넌트 admin **메뉴 순서** 불일치 (freshent 등)

| 항목 | 내용 |
|------|------|
| **증상** | 테넌트별로 `환경설정`/`플랫폼 환경설정`/`알림 발송 이력` 순서가 다름 |
| **원인** | `admin-settings`·`platform-settings` order 충돌, `user_overrides.order` 보존, sync 시 core·확장 미동기화 |
| **수정** | v184 declarative sync — `config/core.php`+`MoabomSystemAdminMenus` order, `MoabomExtensionMenuSyncHelper` override 무시, repair order 복사 금지 |
| **예방** | `DeclarativeMenuOrderGuardListener` · repair `order` 스킵 · `syncCoreMenus` 가드 |

### RF-19b: 테넌트 **환경설정 → 언어팩** 빈 목록

| 항목 | 내용 |
|------|------|
| **증상** | 마스터는 언어팩 목록 표시, 테넌트는 "설치된 언어팩 없음" (+ 로딩 스피너가 이상하게 보임) |
| **원인** | `LanguagePackBundledRegistrar::scanLocales()` 가 `ko.json` 루트 파일 무시; platform mirror 가 `active` 만 복제 |
| **구조적 원인** | 번역 **파일**은 전역 공유(`base_path('lang-packs/')`)인데 카탈로그(`language_packs`)·**admin UI 레이아웃**(`template_layouts.admin_settings`)·메뉴는 **테넌트 DB 복사본** → 흩어진 동기화 잡이 전부 성공해야만 일치. 한 단계라도 `\|\| true` 로 묻히면 그 테넌트만 비어 보임 |
| **수정** | v184 `TenantLanguagePackMirror` — platform `language_packs` 단일 mirror (메뉴 sync 분리) |
| **B안(재발 종결)** | **`moabom:saas:tenant-reconcile`** — layouts·메뉴·language_packs 를 한 명령으로 수렴 + **동기화 후 실제 사용자 표면 검증**(언어팩 목록 0건·admin_settings 구형 잔존 → 비정상 종료). entrypoint/Job/provision 에 **검증 패스**가 박혀 깨진 테넌트를 silent 가 아니라 ERROR/Job 실패로 드러냄 |
| **예방** | `moabom:saas:tenant-reconcile` (검증 내장) · `MOABOM_VERIFY_TENANT_RECONCILE` · `check-saas-runtime-invariants.sh` reconcile 가드 |

> **핵심:** 번들 언어팩 18종이 이미지에 항상 있으므로 **정상 테넌트는 언어팩 목록이 절대 0건일 수 없다.** `tenant-reconcile` 검증은 정확히 이 불변식(`list(exclude_protected=1) > 0`)을 점검한다.

### RF-18b: 테넌트 admin **언어팩·$t: 키** 미동작

| | |
|---|---|
| **증상** | 마스터 admin 환경설정·모듈 UI 번역 정상, 테넌트만 `$t:moabom-system.*` 키 노출 |
| **원인** | provision 시 `language_packs` 미복제 + `core.modules.after_install` 훅 미실행 |
| **조치** | `moabom:saas:sync-tenant-admin-menus` (bundled lang 등록 포함) · 신규 tenant는 `TenantPackageDatabaseSeeder` mirror |
| **캐시** | `TenantScopedCacheDecorator` — platform/tenant lang 캐시 분리 |

### RF-17: SaaS 마이페이지 **appearance** 저장 누락

| | |
|---|---|
| **증상** | 메뉴·시스템 옵션은 저장되나 **화면 테마·배경** 탭 PUT 무효 |
| **원인** | `SystemSettingsService::saveSettings()` 가 SaaS에서 `appearance` 카테고리 **continue(스킵)** |
| **조치** | `SystemSettingsController::store` — `saas.enabled` 시 **`TenantSettingsWriter::write()`** (replaceSettings) |
| **예방** | `AdminSettingsSaasAppearanceStoreTest` · guards RF-17 |

### RF-15: SaaS hospitals — 모듈 i18n `$t:` prefix 누락

| | |
|---|---|
| **증상** | `admin.saas.hospitals.create_title` 등 **키 문자열 그대로** |
| **원인** | 모듈 레이아웃 `$t:admin.saas.*` — `$t:moabom-system.admin.saas.*` 필수 |
| **착각** | template `$t:admin.*` 과 동일 규칙 |
| **조치** | layout `$t:` 전체 prefix 수정 |
| **예방** | `saas-hospitals-admin-gate.sh` · lang API: `/api/templates/moabom-admin_basic/lang/ko.json` |

### RF-16: SaaS hospitals — 목록 `forEach` (G7 `iteration` 아님)

| | |
|---|---|
| **증상** | 헤더·버튼은 보이나 **업체 행 없음** — API list 200 |
| **원인** | `"forEach"` — G7 미지원; **`iteration`** 만 유효 |
| **착각** | 생성 폼 `iteration` 정상 → 목록도 완료로 간주 |
| **조치** | `Tr` → `iteration: { source, item_var: "item" }` |
| **예방** | gate `forEach` 금지 · [layout-json-components-rendering.md](../app/docs/frontend/layout-json-components-rendering.md) |

### RF-17: SaaS hospitals — `handler: confirm` (admin 미등록)

| | |
|---|---|
| **증상** | DB/Storage/전체 삭제 클릭 → **`Unknown action handler: confirm`** |
| **원인** | `moabom-admin_basic` 템플릿에 `confirm` **핸들러 없음** — `sirsoft-basic` shop 모달만 레거시 사용 |
| **올바른 패턴** | `handler: apiCall` + **`confirm` 속성** (ActionDispatcher 내장 `window.confirm`) |
| **조치** | v1.2.1 `admin_saas_hospitals.json` — 중첩 confirm 핸들러 제거 |
| **예방** | `saas-hospitals-admin-gate.sh` — `"handler": "confirm"` 금지 |

---

## 2. 배포 체크리스트 (한 사이클)

### 코드에 admin 레이아웃·SaaS 커맨드 변경 시

- [ ] `templates/moabom-admin_basic/layouts/` SSOT 확인 (`memory_usage?.used` 등)
- [ ] `modules/moabom-system` 활성 경로에 커맨드·Provider·**module layout** 반영
- [ ] `./deploy/check-before-cloud-build.sh` 통과 (포함: `saas-hospitals-admin-gate.sh`)
- [ ] `_IMAGE_TAG` **1회만** 증가
- [ ] `./deploy/build-and-deploy.sh` (또는 async → deploy **필수**)
- [ ] `smoke-after-deploy.sh` 통과
- [ ] (자동) `build-and-deploy.sh` 가 layout sync Job 실행 — **module layout sync SUCCESS** 포함 (RF-14)
- [ ] SaaS hospitals 변경 시: `saas-hospitals-admin-gate.sh` 통과 + lang API + 브라우저 강력 새로고침 (선택 e2e는 `deploy/saas-platform-hospitals-smoke.sh` 추가 시)
- [ ] freshent 등 tenant admin → 환경설정 → 정보 탭 확인

### env만 변경

- [ ] `./deploy/build-and-deploy.sh --env-only`

---

## 3. 빠른 명령 참조

| 목적 | 명령 |
|------|------|
| 배포 전 검증 | `./deploy/check-before-cloud-build.sh` |
| 빌드+배포+smoke | `./deploy/build-and-deploy.sh` |
| 레이아웃 DB sync (수동·async 후) | `IMAGE_TAG=vN bash deploy/run-layout-sync-job.sh` |
| **layout Job 실패 후 재실행 (재빌드 금지)** | `IMAGE_TAG=vN bash deploy/run-post-deploy-layout-pipeline.sh` |
| **테넌트 수렴+검증 (단일 SSOT)** | `php artisan moabom:saas:tenant-reconcile` (생략=platform+active tenants) |
| 특정 테넌트만 수렴+검증 | `php artisan moabom:saas:tenant-reconcile freshent` |
| 검증만 (동기화 생략) | `php artisan moabom:saas:tenant-reconcile --skip-template-layouts --skip-module-layouts --skip-menus --skip-language-packs` |
| 레이아웃 DB sync (일반 배포) | `build-and-deploy.sh` 가 자동 실행 |
| 테넌트 1곳만 sync | `source deploy/lib/cloud-run-artisan-job.sh && moabom_run_artisan_job moabom-layout-sync-one 900s moabom:saas:sync-template-layouts freshent --template=moabom-admin_basic --no-interaction` |
| Job 실패 로그 | `gcloud logging read 'resource.type="cloud_run_job" resource.labels.job_name="moabom-layout-sync"' --project=smartmek --limit=20` |

---

## 4. 변경 이력 (요약)

| 날짜 | 태그/이슈 | 교훈 |
|------|-----------|------|
| 2026-07-10 | **RF-29** | `build:core \|\| true` → 구 template-engine 서빙 → 관리자 blur 영구. layout-sync skip과 무관. hard-fail + DataGate 검증 |
| 2026-07-10 | **RF-31** | 로그인 공지 상세 500 — `board_attachments.trigger_type` 미적용. post-deploy migrate 가 moabom-* 만 돌려 sirsoft-board schema drift. 배포≠코드 롤백 |
| 2026-07-10 | **RF-30** | board attachment preview 가 로컬 `fileResponse` 의존 → GCS Cloud Run 500. 목록 API 200 과 별개. `AttachmentService::preview()` 스트리밍 |
| 2026-07-10 | **RF-29** | G7 7.0.2 Composer `TemplateManager` 시그니처 — Moabom 래퍼 미전달 시 HTML 전면 500. ready smoke ≠ SPA OK |
| 2026-07-10 | **RF-28** / v462 | `Driver [gcs] is not supported` — Spatie GCS 가 boot() 전용인데 SettingsServiceProvider::register() 가 settings(gcs) 디스크 선사용. `EarlyGoogleCloudStorageServiceProvider` 로 register 단계 등록 |
| 2026-07-10 | **RF-27** / v461 | `package:discover` 시 SettingsServiceProvider → JsonConfigRepository `Cache::remember` 가 CacheServiceProvider 이전 호출 → `Target class [cache]`. `app()->bound('cache')` 가드 + Dockerfile `G7_JSON_SETTINGS_CACHE_TTL=0` |
| 2026-07-10 | **RF-26** / v461 | `*.run.app` allUsers + 무검증 `X-Forwarded-Host` → 테넌트 스푸핑. `TenantRequestHost` allowlist + `--ingress=internal-and-cloud-load-balancing` |
| 2026-07-10 | **RF-25** / v460 | upstream timed out = nginx 60s + 무거운 credits. `fastcgi_read_timeout 120s` + `limit=0` |
| 2026-07-10 | **RF-24** | layout Job 실패 ≠ 재빌드. SoftDeletes 계약 + `run-post-deploy-layout-pipeline.sh` + Job update skip |
| 2026-06-02 | v159~v160 | module i18n `$t:moabom-system.*` · module layout sync · `forEach`→`iteration` (RF-14~16) |
| 2026-06-02 | **A·B 완료** | `DEPLOY-RECURRING-FAILURES` · 가드 · build-and-deploy 자동 layout sync · entrypoint 재시도; **C 범위 외** |
| 2026-06-02 | v154~v155 | layout JSON ≠ DB; sync Job slug `*` 금지; TemplateManager 직접 refresh; 운영 Job 1회 성공 |
| 2026-05 | v7~v17 | Cloud Build only; autoload; storage chown; no route:cache |
| 2026-05 | async | deploy 단계 누락 = 시간 2배 |

---

## 5. 관련 문서

| 문서 | 범위 |
|------|------|
| [README.md](./README.md) | deploy/ 인덱스·파이프라인·파일 역할 |
| [core-patches/README.md](./core-patches/README.md) | G7 코어 패치 캡슐 |
| [check-deploy-recurring-guards.sh](./check-deploy-recurring-guards.sh) | 재발 방지 정적 검증 |
