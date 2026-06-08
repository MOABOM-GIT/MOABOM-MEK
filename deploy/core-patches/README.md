# Moabom 최소 코어 패치 (Cloud Run SaaS)

> **SSOT:** 멀티테넌트 SaaS + GCS + Cloud Run 운영에 필요한 **최소 코어 delta**만 보관.  
> `core:update` 직후 `apply-core-patches.sh`로 재적용.

## 운영 전제 (Moabom)

| 항목 | 정책 |
|------|------|
| 배포 | **Cloud Build → Cloud Run만** (로컬 빌드/로컬 배포 없음) |
| 확장 SSOT | 활성 `modules/moabom-*`, `templates/moabom-*`, `plugins/moabom-*` |
| `_bundled/*` | upstream 미러·참고용. **런타임·이미지·개발 SSOT 아님** (` .gcloudignore` 제외) |
| 코어 철학 | 우회로로 코어 비접촉을 억지할 필요 없음 — **구조적으로 효율적인 최소 코어 수정**이 맞음 |

## 패치 규모 (beta.7 기준)

| | |
|---|---|
| `moabom-core.patch` | **18파일** (이전 21 → 정리 후) |
| 패치 밖 필수 | `composer.json` / `composer.lock` — `spatie/laravel-google-cloud-storage` |

### 제거·분리한 것 (코어 패치에 넣지 않음)

| 항목 | 처리 |
|------|------|
| `phpunit.xml`, `tsconfig.json`, `tests/bootstrap.php` | upstream 복원 — Run 무관, Moabom 전용이면 `deploy/` 쪽으로 분리 |
| `GzipEncodeResponse` + 테스트 | upstream 복원 — `deploy/nginx-cloudrun.conf` gzip 사용 |
| `_bundled` moabom 오염·chmod 노이즈 | `git checkout HEAD -- …/_bundled` 로 미러 복원 |
| `tests/bootstrap.php` `_bundled` 제거 | upstream 복원 (활성 확장 테스트는 CI/모듈 스위트로) |

## 18파일 분류

### ① 확장 주입 훅 (upstream PR 후보 — Moabom 하드코딩 없음)

| 파일 | 역할 |
|------|------|
| `config/core.php` | `config_clear_guards`, `identity_policy_middleware.*` 빈 배열 |
| `app/Services/SettingsService.php` | `config:clear` 생략 가드 (설정만 소비) |
| `app/Http/Middleware/EnforceIdentityPolicy.php` | shell-boot 등 공개 경로 IDV 스킵 (설정만 소비) |

`moabom-system` `configureCoreRuntimeGuards()`가 런타임에 값 주입.

### ② Cloud Run / GCS 부트 체인 (필수)

| 파일 | 역할 |
|------|------|
| `config/filesystems.php` | `gcs` 디스크 + `FILESYSTEM_DISK=gcs` 시 확장 디스크 |
| `bootstrap/providers.php` | Spatie GCS Provider (Settings 로드 전 등록) |
| `app/Providers/SettingsServiceProvider.php` | JSON 설정 로드 `register()` → `boot()` |
| `composer.json` | Spatie 패키지 (**패치 밖**, lock 동반) |

### ③ Cloud Run / SaaS 런타임 효율

| 파일 | 역할 |
|------|------|
| `bootstrap/app.php` | `trustProxies(at: '*')` — HTTPS·`asset()` |
| `resources/views/app.blade.php`, `admin.blade.php` | template-engine 절대경로, bunny 폰트 비활성 |
| `config/moabom-saas.php` | SaaS env SSoT (`config:cache` 대상) |
| `config/cache.php` | `g7_json_settings_ttl`, `moabom_public_boot_ttl` |
| `config/database.php` | `DB_PERSISTENT`, SSL CA (`production.env.yaml`) |
| `app/Repositories/JsonConfigRepository.php` | 부트 경로 GCS settings 읽기 캐시 (`SettingsServiceProvider`가 `new` 사용) |
| `app/Providers/ModuleRouteServiceProvider.php` | `.env` 없는 Run + `ModuleManager` 캐시 |
| `app/Providers/PluginRouteServiceProvider.php` | `.env` 없는 Run 가드 |
| `app/Http/Controllers/Api/Public/PublicTemplateController.php` | `resolveCacheVersion()` 폴백 |

### ④ 코어 엔진·검증

| 파일 | 역할 |
|------|------|
| `resources/js/core/TemplateApp.ts` | `mergeComputedRecalc()` |
| `tests/Feature/Api/Admin/SettingsControllerTest.php` | ① 가드 회귀 테스트 |

## 사용

```bash
# 적용 가능 여부
bash deploy/core-patches/apply-core-patches.sh --check

# core:update 직후
bash deploy/core-patches/apply-core-patches.sh

# 코어 delta 변경 후 패치 재생성
bash deploy/core-patches/regenerate.sh
```

`composer.json` Spatie 의존성은 패치에 포함되지 않음 — `core:update` 후 `composer require spatie/laravel-google-cloud-storage` 확인.

## `core:update` 루틴 (권장)

```bash
php artisan core:update
bash deploy/core-patches/apply-core-patches.sh
# composer.lock 에 spatie 존재 확인
php artisan config:cache   # Cloud Run entrypoint 와 동일
```

활성 확장·`deploy/production.env.yaml`·Cloud Build는 **코어 패치와 별도** — 변경하지 않음.

## upstream 패치 검증 (beta.7 = `main` 기준, 2026-06-08)

```bash
git clone https://github.com/gnuboard/g7.git /tmp/g7-test
cd /tmp/g7-test && git apply --check /path/to/moabom-core.patch   # OK
git apply --check /path/to/g7-upstream-hooks.patch                 # OK
```

## upstream PR 준비 (`g7-upstream-hooks.patch`)

`gnuboard/g7` 기여 1순위 — **Moabom 문자열 없는 범용 확장 훅 3파일 + 회귀 테스트**:

- `config/core.php`
- `app/Services/SettingsService.php`
- `app/Http/Middleware/EnforceIdentityPolicy.php`
- `tests/Feature/Api/Admin/SettingsControllerTest.php`

머지 후 Moabom `moabom-core.patch`에서 해당 hunks 제거 가능.

## 배포 전 게이트 (Cloud Build 공통)

```bash
bash deploy/check-before-cloud-build.sh   # v7-6c 패치 + v7-6d 가드 포함
bash deploy/check-core-sync-regression.sh # core:update 후 sync 회귀
```
