# deploy/ — Moabom 운영 SSOT

Cloud Build → Cloud Run 배포 파이프라인과 검증 게이트. **운영 이미지는 이 경로로만** 만든다.

```mermaid
flowchart LR
  subgraph pre [제출 전]
    CB[check-before-cloud-build.sh]
    CB --> CP[check-core-patches]
    CB --> RF[check-deploy-recurring-guards]
    CB --> V8[check-saas-runtime-invariants]
    CB --> HOSP[saas-hospitals-admin-gate]
    CB --> REF[check-moabom-refactor-invariants]
  end
  subgraph build [Cloud Build]
    YAML[cloudbuild-v3.yaml]
    DF[Dockerfile]
    YAML --> CB
    YAML --> DF
  end
  subgraph run [배포 후]
    BAD[build-and-deploy.sh]
    SM[smoke-after-deploy.sh]
    LS[run-layout-sync-job.sh]
    PE[run-saas-phase-e-post-deploy.sh]
    BAD --> SM
    BAD --> LS
    BAD --> PE
  end
  pre --> build
  build --> run
```

## 핵심 파일 (삭제·이동 금지)

| 파일 | 역할 |
|------|------|
| `cloudbuild-v3.yaml` | `_IMAGE_TAG` SSOT, Cloud Build 단일 진입 |
| `Dockerfile` | 운영 이미지 (assets·vendor·dist·entrypoint) |
| `cloudrun-entrypoint.sh` | 부팅: migrate, SaaS sync, layout retry |
| `nginx-cloudrun.conf` | Run nginx (gzip, `/api/` Laravel-first) |
| `supervisord.conf` | php-fpm + nginx |
| `production.env.yaml` | Run 환경 변수 (시크릿은 Secret Manager) |
| `build-and-deploy.sh` | 검증 → submit → deploy → smoke → layout sync |
| `check-before-cloud-build.sh` | 제출 전 통합 게이트 (v7+v8) |
| `DEPLOY-RECURRING-FAILURES.md` | RF 증상·원인·조치 카탈로그 |

## lib/ · ssot/

| 파일 | 역할 |
|------|------|
| `lib/gcp-env.sh` | GCP project·region·Run·SQL·시크릿 매핑 SSOT |
| `lib/image-tag.sh` | `cloudbuild-v3.yaml` `_IMAGE_TAG` 읽기 |
| `lib/cloud-run-artisan-job.sh` | Cloud Run Job 래퍼 (`*` 인자 거부 RF-12) |
| `ssot/moabom-system.config.php` | → `modules/moabom-system/config/` 복사 원본 |
| `ssot/decomposition-api-compat.json` | 분리 모듈 API compat 계약 |

## 검증 게이트 (`check-before-cloud-build.sh` 가 호출)

| 스크립트 | 검사 대상 |
|----------|-----------|
| `check-core-patches.sh` | `core-patches/moabom-core.patch` 정합성 |
| `check-g7-core-guard-regression.sh` | 코어 가드 주입 회귀 |
| `check-bundled-detach-regression.sh` | 활성 경로 `_bundled` 참조 0 |
| `check-bundle-budget.sh` | moabom-basic 번들 크기 (repo dist 있을 때) |
| `check-deploy-recurring-guards.sh` | RF-01~17 정적 가드 |
| `check-saas-runtime-invariants.sh` | SaaS·분리 모듈·entrypoint 배선 (대형) |
| `saas-hospitals-admin-gate.sh` | 병원 admin 레이아웃·i18n |
| `check-moabom-admin-basic-ssot.sh` | admin 템플릿 SSOT |
| `check-moabom-refactor-invariants.sh` | 리팩토링 불변식 |
| `smoke-social-auth.sh` | SNS OAuth 정적·구성 검증 |

## 배포 후·Job

| 스크립트 | 역할 |
|----------|------|
| `smoke-after-deploy.sh` | HTTP 스모크 (shell-boot, weather, 분리 모듈) |
| `run-layout-sync-job.sh` | template·module layout DB sync Job |
| `run-saas-phase-e-post-deploy.sh` | Phase E (platform-migrate·permissions) |

## 이미지에 COPY되는 SaaS 헬퍼 (`Dockerfile`)

| 스크립트 | 역할 |
|----------|------|
| `saas-module-sync.sh` | 모듈 선언·layout refresh (수동/Job) |
| `saas-clone-tenant.sh` | 테넌트 DB 클론 |
| `saas-extension-bootstrap.sh` | `sync-package-extensions` |
| `saas-tenant-extension-sync.sh` | 테넌트 확장 insert-only/activate |

## entrypoint·invariant가 요구하는 래퍼 (이미지 밖에서도 존재해야 함)

| 스크립트 | 역할 |
|----------|------|
| `saas-template-layout-sync.sh` | layout sync 단일 래퍼 |
| `saas-tenant-admin-token-job.sh` | 테넌트 admin 토큰 Job |

## G7 upstream (배포와 별도 — `core:update` 전)

| 스크립트 | 역할 |
|----------|------|
| `check-upstream-prep.sh` | 패치·가드·bundled-detach·dry-run 통합 |
| `check-core-sync-regression.sh` | core:update sync 회귀 |
| `dry-run-upstream-patches.sh` | 패치 dry-run |
| `core-patches/*` | G7 overlay patch 적용 스크립트와 패치 — [`README.md`](core-patches/README.md) |
| `core-overlay/manifest.json` | overlay 파일 분류 SSOT. `check-core-patches.sh`가 패치 파일 목록과 비교 |

## 유틸

| 스크립트 | 역할 |
|----------|------|
| `secret-manager-bootstrap.sh` | 시크릿 1회 부트스트랩 |
| `push-moabom-mek.sh` | GitHub push |
| `saas-config-cache-parity.sh` | 로컬 docker `config:cache` 후 tenant 격리 (선택) |

## 선택 SaaS 스모크 (미포함 — 있을 때만 실행)

`smoke-after-deploy.sh` 가 `deploy/` 아래에 아래 스크립트가 **있을 때만** 추가 실행한다. 기본 배포에는 포함하지 않으며, 없으면 SKIP (`MOABOM_STRICT_SMOKE=1` 이면 FAIL):

- `saas-wildcard-smoke.sh`
- `smoke-saas-tenant-shell-boot.sh`
- `e2e-tenant-isolation-dod.sh`
- `saas-platform-hospitals-smoke.sh`
- `saas-tenant-admin-smoke.sh`

## 빠른 명령

```bash
bash deploy/check-before-cloud-build.sh
./deploy/build-and-deploy.sh
IMAGE_TAG=vN bash deploy/run-layout-sync-job.sh   # async 배포 후 수동
bash deploy/check-upstream-prep.sh                # G7 upstream 전
```

## 문서 SSOT

배포·RF 절차는 **본 README** + [`DEPLOY-RECURRING-FAILURES.md`](DEPLOY-RECURRING-FAILURES.md) + [`.cursor/rules/`](../.cursor/rules/) 만 따른다. 과거 실험 문서·장문 배경은 Git 이력에서만 참고한다.
