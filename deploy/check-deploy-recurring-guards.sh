#!/usr/bin/env bash
# 배포 재발 방지 — 정적 가드 (DEPLOY-RECURRING-FAILURES.md)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${ROOT}/app"
FAIL=0

fail() { echo "FAIL: $*"; FAIL=1; }
ok() { echo "OK:   $*"; }

echo "== check-deploy-recurring-guards =="

ENTRY="${ROOT}/deploy/cloudrun-entrypoint.sh"
DEFERRED="${ROOT}/deploy/cloudrun-deferred-sync.sh"
SYNC_CMD="${APP}/modules/moabom-system/src/Console/Commands/SaasSyncTemplateLayoutsCommand.php"
PROVISION="${APP}/modules/moabom-system/src/Saas/TenantProvisionArtisanRunner.php"
CRJ="${ROOT}/deploy/lib/cloud-run-artisan-job.sh"
BUILD_DEPLOY="${ROOT}/deploy/build-and-deploy.sh"
TAB_INFO="${APP}/templates/moabom-admin_basic/layouts/partials/admin_settings/_tab_info.json"

# RF-01: memory Span 바인딩
[[ -f "${TAB_INFO}" ]] || fail "_tab_info.json 없음"
if grep -q 'memory_usage ??' "${TAB_INFO}" 2>/dev/null; then
  fail "RF-01: memory_usage 객체 직접 렌더 패턴 (React #31)"
else
  ok "RF-01: _tab_info memory_usage 필드 바인딩"
fi

# RF-02 / RF-12: sync 커맨드 + entrypoint * 금지
[[ -f "${SYNC_CMD}" ]] || fail "SaasSyncTemplateLayoutsCommand 없음"
grep -q '{slug\?' "${SYNC_CMD}" \
  || fail "RF-02: sync-template-layouts — slug optional 인자 없음"
grep -q 'TemplateManagerInterface' "${SYNC_CMD}" \
  || fail "RF-02: sync — TemplateManager 직접 refresh 미사용"
grep -q 'LEGACY_MEMORY_SPAN_PATTERN' "${SYNC_CMD}" \
  || fail "RF-01: sync 후 admin_settings memory 검증 없음"
grep -q "template:cache-clear" "${SYNC_CMD}" \
  || fail "RF-08: sync 커맨드 끝에 template:cache-clear 없음"

if grep -q "sync-template-layouts '\*'" "${ENTRY}" "${DEFERRED}" 2>/dev/null \
  || grep -q 'sync-template-layouts "\*"' "${ENTRY}" "${DEFERRED}" 2>/dev/null; then
  fail "RF-12: entrypoint 에 sync-template-layouts '*' — slug 생략 필요"
else
  ok "RF-12: entrypoint sync slug * 미사용"
fi

grep -q 'MOABOM_SYNC_TEMPLATE_LAYOUTS' "${ENTRY}" "${DEFERRED}" \
  || fail "RF-08: entrypoint MOABOM_SYNC_TEMPLATE_LAYOUTS 가드 없음"
grep -q 'moabom:saas:sync-template-layouts' "${ENTRY}" "${DEFERRED}" \
  || fail "RF-08: entrypoint layout sync 호출 없음"
ok "RF-08: entrypoint layout sync 블록"

# RF-07: provision admin template refresh
grep -q 'template:refresh-layout' "${PROVISION}" \
  || fail "RF-07: TenantProvisionArtisanRunner admin template refresh 없음"
grep -q 'activeAdminTemplate' "${PROVISION}" \
  || fail "RF-07: provision activeAdminTemplate refresh 연동 없음"
ok "RF-07: provision admin template refresh"

# RF-12: Job helper * 거부
grep -q 'arg.*== "\*"' "${CRJ}" \
  || fail "RF-12: cloud-run-artisan-job.sh 에 * 인자 거부 없음"
ok "RF-12: cloud-run-artisan-job * 거부"

# RF-12: tenant-repair 도 slug 생략 (Cloud Run Job 에 * 전달 금지)
if grep -qE "tenant-repair ['\"]?\\*" "${BUILD_DEPLOY}" "${DEFERRED}" \
  "${ROOT}/deploy/saas-tenant-extension-sync.sh" 2>/dev/null; then
  fail "RF-12: tenant-repair '*' — slug 생략 필요 (RF-32 insert-only Job)"
fi
grep -q '{slug\?' "${ROOT}/app/modules/moabom-system/src/Console/Commands/SaasTenantRepairCommand.php" \
  || fail "RF-12: tenant-repair slug optional 아님"
ok "RF-12: tenant-repair slug 생략 (RF-32)"

[[ -x "${ROOT}/deploy/run-layout-sync-job.sh" ]] \
  || fail "RF-13: run-layout-sync-job.sh 없음 또는 실행 불가"
grep -q 'moabom:saas:sync-module-layouts' "${ROOT}/deploy/run-layout-sync-job.sh" \
  || fail "RF-14b: run-layout-sync-job.sh 에 moabom:saas:sync-module-layouts 없음"
grep -q 'moabom:saas:sync-module-declarations' "${ROOT}/deploy/run-layout-sync-job.sh" \
  || fail "RF-14d: run-layout-sync-job.sh 에 moabom:saas:sync-module-declarations 없음 (moabom-apps 권한 누락)"
grep -q 'moabom-apps' "${ROOT}/deploy/run-layout-sync-job.sh" \
  || fail "RF-14d: run-layout-sync-job — moabom-apps declarations sync 경로 없음"
ok "RF-13/RF-14b: run-layout-sync-job.sh (template + module layouts)"
ok "RF-14d: run-layout-sync-job module declarations SSOT (moabom-apps 포함)"

[[ -x "${ROOT}/deploy/run-template-cache-clear-job.sh" ]] \
  || fail "RF-23: run-template-cache-clear-job.sh 없음 또는 실행 불가"
LAYOUT_PIPELINE="${ROOT}/deploy/run-post-deploy-layout-pipeline.sh"
grep -q 'run-template-cache-clear-job.sh' "${LAYOUT_PIPELINE}" \
  || fail "RF-23: layout pipeline — layout skip 시 cache-clear Job 없음"
grep -q 'run-template-cache-clear-job.sh' "${ROOT}/deploy/run-layout-sync-job.sh" \
  || fail "RF-23: run-layout-sync-job.sh — cache-clear Job SSOT 미사용"

grep -q 'moabom:saas:sync-module-layouts' "${ENTRY}" "${DEFERRED}" \
  || fail "RF-14b: entrypoint 에 moabom:saas:sync-module-layouts 없음"
grep -q 'MOABOM_SYNC_MODULE_LAYOUTS' "${ENTRY}" "${DEFERRED}" \
  || fail "RF-14b: entrypoint MOABOM_SYNC_MODULE_LAYOUTS 가드 없음"
ok "RF-14b: entrypoint module layout sync"

grep -q 'ModuleLayoutSyncCatalog::resolveModuleOption' "${ROOT}/app/modules/moabom-system/src/Console/Commands/SaasSyncModuleLayoutsCommand.php" \
  || fail "RF-14c: sync-module-layouts 가 ModuleLayoutSyncCatalog 미사용 (moabom-apps 등 누락)"
ok "RF-14c: module layout sync all modules with layouts"

SETTINGS_CTRL="${APP}/modules/moabom-system/src/Http/Controllers/Admin/SystemSettingsController.php"
grep -q 'TenantSettingsWriter' "${SETTINGS_CTRL}" \
  || fail "RF-17: SystemSettingsController 가 TenantSettingsWriter 미사용 (SaaS appearance 저장)"
grep -q "config('moabom-system.saas.enabled'" "${SETTINGS_CTRL}" \
  || fail "RF-17: SystemSettingsController SaaS 분기 없음"
ok "RF-17: admin/settings store → TenantSettingsWriter (SaaS)"

SP="${APP}/modules/moabom-system/src/Providers/SystemServiceProvider.php"
CACHE_DECORATOR="${APP}/modules/moabom-system/src/Saas/TenantScopedCacheDecorator.php"
grep -q 'TenantScopedCacheDecorator' "${SP}" \
  || fail "RF-18b: SystemServiceProvider TenantScopedCacheDecorator 미등록"
[[ -f "${CACHE_DECORATOR}" ]] || fail "RF-18b: TenantScopedCacheDecorator 없음"
ok "RF-18b: SaaS template cache tenant scope"

[[ -f "${ROOT}/deploy/DEPLOY-RECURRING-FAILURES.md" ]] \
  || fail "DEPLOY-RECURRING-FAILURES.md 없음"
ok "DEPLOY-RECURRING-FAILURES.md SSOT"

# RF-20: WSL 호스트 npm 으로 활성 프론트 로컬 빌드 금지 가드
SHARED_BUILD_GUARD="${APP}/scripts/guard-no-host-build.cjs"
[[ -f "${SHARED_BUILD_GUARD}" ]] \
  || fail "RF-20: app/scripts/guard-no-host-build.cjs 없음 (공통 호스트 로컬 빌드 차단 가드)"

check_host_build_guard() {
  local label="$1"
  local pkg="$2"
  local guard_cmd="$3"

  [[ -f "${pkg}" ]] || { fail "RF-20: ${label} package.json 없음"; return; }
  grep -q "\"preinstall\"[[:space:]]*:[[:space:]]*\"${guard_cmd}\"" "${pkg}" \
    || fail "RF-20: ${label} package.json preinstall 가드 미연결"
  grep -q "\"prebuild\"[[:space:]]*:[[:space:]]*\"${guard_cmd}\"" "${pkg}" \
    || fail "RF-20: ${label} package.json prebuild 가드 미연결"
  grep -q "\"predev\"[[:space:]]*:[[:space:]]*\"${guard_cmd}\"" "${pkg}" \
    || fail "RF-20: ${label} package.json predev 가드 미연결"
}

check_host_build_guard "moabom-basic" "${APP}/templates/moabom-basic/package.json" "node scripts/guard-no-host-build.cjs"
check_host_build_guard "moabom-admin_basic" "${APP}/templates/moabom-admin_basic/package.json" "node ../../scripts/guard-no-host-build.cjs"
ok "RF-20: 활성 프론트 호스트 로컬 npm 가드 (preinstall/prebuild/predev)"

grep -q '\*\*/dist/' "${ROOT}/.gcloudignore" \
  || fail "RF-20: .gcloudignore 에 **/dist/ 제외 없음 (로컬 stale dist 업로드 위험)"
grep -q '\*\*/dist' "${ROOT}/.dockerignore" \
  || fail "RF-20: .dockerignore 에 **/dist 제외 없음 (로컬 stale dist 이미지 입력 위험)"
ok "RF-20: 로컬 dist 업로드/이미지 입력 제외"

# RF-21 / RF-32: RUN_MIGRATIONS=false 운영에서도 schema plane(core/module/plugin) + tenant fan-out
grep -q 'RUN_MIGRATIONS: "false"' "${ROOT}/deploy/production.env.yaml" \
  && {
    grep -q 'Post-deploy schema-sync\|Post-deploy schema planes skipped\|moabom:saas:schema-sync' "${BUILD_DEPLOY}" \
      || fail "RF-32: build-and-deploy.sh 에 schema-sync post-deploy 단계 없음"
    grep -q 'saas-migration-planes.sh' "${BUILD_DEPLOY}" \
      || fail "RF-32: build-and-deploy.sh 가 saas-migration-planes.sh 미사용"
    [[ -f "${ROOT}/deploy/lib/saas-migration-planes.sh" ]] \
      || fail "RF-32: deploy/lib/saas-migration-planes.sh 없음"
    grep -q 'moabom_saas_list_changed_planes' "${ROOT}/deploy/lib/saas-migration-planes.sh" \
      || fail "RF-32: plane 목록 함수 없음"
    grep -q 'moabom:saas:schema-sync' "${BUILD_DEPLOY}" \
      || fail "RF-32: build-and-deploy.sh 가 moabom:saas:schema-sync Job 을 실행하지 않음"
    grep -q 'insert-only' "${BUILD_DEPLOY}" \
      || fail "RF-32: post-deploy tenant extension availability(insert-only) 없음"
    grep -q 'copyCatalog\|baselineExistingCreates' "${ROOT}/app/modules/moabom-system/src/Saas/SaasTenantMigrationBaseliner.php" \
      || fail "RF-32: SaasTenantMigrationBaseliner 없음"
    grep -q 'copyCatalog' "${ROOT}/app/modules/moabom-system/src/Saas/TenantDatabaseBootstrapper.php" \
      || fail "RF-32: provision migrations catalog 복사 없음"
    grep -q 'sirsoft-gdpr' "${ROOT}/app/modules/moabom-system/database/saas/packages/hospital-default.json" \
      || fail "RF-32: hospital-default 에 sirsoft-gdpr 없음"
    grep -q 'sirsoft-verification_kginicis' "${ROOT}/app/modules/moabom-system/database/saas/packages/hospital-default.json" \
      || fail "RF-32: hospital-default 에 sirsoft-verification_kginicis 없음"
    grep -q 'sirsoft-pay_kginicis' "${ROOT}/app/modules/moabom-system/database/saas/packages/hospital-default.json" \
      || fail "RF-32: hospital-default 에 sirsoft-pay_kginicis 없음"
    grep -q 'moabom:saas:sync-package-extensions' "${BUILD_DEPLOY}" \
      || fail "RF-32: build-and-deploy 에 sync-package-extensions 없음 (플랫폼 install → tenant 가용성)"
    grep -q 'namespace Modules\\Moabom\\Global\\Search;' \
      "${ROOT}/app/modules/moabom-global-search/module.php" \
      || fail "RF-32: moabom-global-search 네임스페이스가 G7 directoryToNamespace 와 불일치"
    grep -q 'moabom-global-search' "${ROOT}/app/modules/moabom-global-search/composer.json" \
      || fail "RF-32: moabom-global-search composer.json 없음"
    python3 - "${BUILD_DEPLOY}" <<'PY' || fail "RF-32: schema-sync 가 run_smoke 보다 뒤에 있음"
import sys
text = open(sys.argv[1], encoding="utf-8").read()
sync = text.find("Post-deploy schema-sync")
if sync == -1:
    sync = text.find("Post-deploy schema planes skipped")
smoke = text.find("run_smoke", sync if sync != -1 else 0)
raise SystemExit(0 if sync != -1 and smoke != -1 and sync < smoke else 1)
PY
    ok "RF-21/RF-32: schema-sync plane + tenant availability 배포 게이트"
  }

# RF-22: Cloud Run Billing — Request-based (--cpu-throttling) 고정
FLAGS_SSOT="${ROOT}/deploy/lib/cloud-run-service-flags.sh"
[[ -f "${FLAGS_SSOT}" ]] || fail "RF-22: deploy/lib/cloud-run-service-flags.sh 없음"
grep -q 'MOABOM_CLOUD_RUN_BILLING_MODE="request-based"' "${FLAGS_SSOT}" \
  || fail "RF-22: billing SSOT 가 request-based 가 아님"
grep -q 'moabom_cloud_run_service_deploy_args' "${FLAGS_SSOT}" \
  || fail "RF-22: cloud-run-service-flags.sh deploy args 함수 없음"
grep -q -- '--cpu-throttling' "${FLAGS_SSOT}" \
  || fail "RF-22: cloud-run-service-flags.sh 에 --cpu-throttling 없음"
if grep -v '^[[:space:]]*#' "${FLAGS_SSOT}" | grep -q -- '--no-cpu-throttling'; then
  fail "RF-22: cloud-run-service-flags.sh 에 --no-cpu-throttling 금지"
fi
grep -q 'MOABOM_ENTRYPOINT_DEFERRED_SYNC' "${ROOT}/deploy/production.env.yaml" \
  || fail "production.env.yaml 에 MOABOM_ENTRYPOINT_DEFERRED_SYNC 없음"
grep -q 'cloudrun-deferred-sync.sh' "${ROOT}/deploy/supervisord.conf" \
  || fail "supervisord.conf 에 cloudrun-deferred-sync 프로그램 없음"
grep -q 'startup-probe' "${FLAGS_SSOT}" \
  || fail "RF-22: cloud-run-service-flags.sh 에 startup-probe 없음"
grep -q 'MOABOM_CLOUD_RUN_STARTUP_PROBE_PATH' "${FLAGS_SSOT}" \
  || fail "RF-22: startup probe path SSOT 없음"
grep -q 'cloud-run-service-flags.sh' "${BUILD_DEPLOY}" \
  || fail "RF-22: build-and-deploy.sh 가 billing SSOT 미사용"
grep -q -- '--no-cpu-throttling' "${BUILD_DEPLOY}" \
  && fail "RF-22: build-and-deploy.sh 에 --no-cpu-throttling 잔존"
[[ -x "${ROOT}/deploy/check-cloud-run-billing-ssot.sh" ]] \
  || fail "RF-22: check-cloud-run-billing-ssot.sh 없음"
ok "RF-22: Cloud Run Request-based billing SSOT"

# RF-23: 배포 파이프라인 속도 — 조건부 post-deploy·inner check skip·Job boot sleep
grep -q '_SKIP_INNER_CHECK' "${ROOT}/deploy/cloudbuild-v3.yaml" \
  || fail "RF-23: cloudbuild-v3.yaml 에 _SKIP_INNER_CHECK substitution 없음"
grep -q '_SKIP_INNER_CHECK=true' "${BUILD_DEPLOY}" \
  || fail "RF-23: build-and-deploy.sh 가 Cloud Build inner check skip 미전달"
LAYOUT_PIPELINE="${ROOT}/deploy/run-post-deploy-layout-pipeline.sh"
[[ -x "${LAYOUT_PIPELINE}" ]] \
  || fail "RF-24: run-post-deploy-layout-pipeline.sh 없음 또는 실행 불가"
grep -q 'moabom_layout_sync_needed' "${LAYOUT_PIPELINE}" \
  || fail "RF-23: layout pipeline 이 layout sync 해시 게이트 없음"
grep -q 'run-platform-module-layout-reconcile-job.sh' "${LAYOUT_PIPELINE}" \
  || fail "RF-13b: layout pipeline 이 platform module layout reconcile Job 없음"
[[ -x "${ROOT}/deploy/run-platform-module-layout-reconcile-job.sh" ]] \
  || fail "RF-13b: run-platform-module-layout-reconcile-job.sh 없음 또는 실행 불가"
grep -q 'reconcile-platform-module-layouts' "${ROOT}/deploy/run-platform-module-layout-reconcile-job.sh" \
  || fail "RF-13b: reconcile Job 이 moabom:saas:reconcile-platform-module-layouts 호출 안 함"
grep -q 'run-serving-cache-bust.sh' "${LAYOUT_PIPELINE}" \
  || fail "RF-13b: layout pipeline 이 매 배포 serving cache bust 없음"
grep -q 'run-post-deploy-layout-pipeline.sh' "${BUILD_DEPLOY}" \
  || fail "RF-24: build-and-deploy.sh 가 layout pipeline 미호출"
[[ -f "${ROOT}/deploy/ssot/platform-db-layout-versions.env" ]] \
  || fail "RF-23: platform-db-layout-versions.env SSOT 없음"
grep -q 'MOABOM_CRJ_BOOT_SLEEP:-10' "${ROOT}/deploy/lib/cloud-run-artisan-job.sh" \
  || fail "RF-23: cloud-run-artisan-job.sh boot_sleep 기본 10s 아님"
grep -q 'MOABOM_SMOKE_PROFILE' "${ROOT}/deploy/smoke-after-deploy.sh" \
  || fail "RF-23: smoke-after-deploy.sh light/full 프로필 없음"
[[ -f "${ROOT}/deploy/lib/layout-sync-hash.sh" ]] \
  || fail "RF-23: deploy/lib/layout-sync-hash.sh 없음"
[[ -f "${ROOT}/deploy/lib/post-deploy-migration-hash.sh" ]] \
  || fail "RF-23: deploy/lib/post-deploy-migration-hash.sh 없음"
ok "RF-23: 배포 속도 최적화 SSOT (조건부 Job·inner check skip·light smoke)"

# RF-24: layout 정합과 이미지 배포 분리 + SoftDeletes 계약
[[ -x "${ROOT}/deploy/run-post-deploy-layout-pipeline.sh" ]] \
  || fail "RF-24: run-post-deploy-layout-pipeline.sh 없음 또는 실행 불가"
grep -q 'run-post-deploy-layout-pipeline.sh' "${BUILD_DEPLOY}" \
  || fail "RF-24: build-and-deploy.sh 가 layout-only pipeline 미호출"
grep -q 'moabom_cloud_run_job_spec_matches\|skip jobs update' "${ROOT}/deploy/lib/cloud-run-artisan-job.sh" \
  || fail "RF-24: cloud-run-artisan-job.sh 불필요 jobs update 스킵 없음"
grep -q '_IMAGE_TAG 를 올리지 말' "${BUILD_DEPLOY}" \
  || fail "RF-24: layout 실패 시 D1(태그 증가 금지) 안내 없음"
[[ -x "${ROOT}/scripts/check-module-layout-softdeletes-contract.sh" ]] \
  || fail "RF-24: check-module-layout-softdeletes-contract.sh 없음"
ok "RF-24: layout-only pipeline + SoftDeletes contract + Job update skip"

# RF-29: 코어 build:core 폴백 금지 (구 template-engine → 관리자 영구 blur)
if grep -E 'build:core.*\|\|.*true|build:core 2>/dev/null' "${ROOT}/deploy/Dockerfile" >/dev/null 2>&1; then
  fail "RF-29: Dockerfile build:core || true 폴백 — 구 코어 번들 배포 위험"
fi
grep -q "grep -q 'auto_fetch'" "${ROOT}/deploy/Dockerfile" \
  || fail "RF-29: Dockerfile DataGate(auto_fetch) 산출 검증 누락"
grep -q 'v7-9b' "${ROOT}/deploy/check-before-cloud-build.sh" \
  || fail "RF-29: check-before-cloud-build.sh [v7-9b] 게이트 없음"
ok "RF-29: 코어 build:core hard-fail + DataGate 게이트"

# RF-33~34: Reverb signed publish + Cloud Tasks 실제 dequeue 게이트
grep -q 'authenticated publish' "${ROOT}/deploy/check-realtime-vm-health.sh" \
  || fail "RF-33: Reverb authenticated publish health check 누락"
[[ -x "${ROOT}/deploy/realtime-vm/sync-reverb-secret.sh" ]] \
  || fail "RF-33: Reverb secret 원자 동기화 스크립트 없음"
[[ -x "${ROOT}/deploy/smoke-realtime-notifications.sh" ]] \
  || fail "RF-34: realtime notification 운영 스모크 없음"
grep -q "app('queue.worker')" "${APP}/modules/moabom-system/src/Http/Controllers/InternalQueueTaskController.php" \
  || fail "RF-34: queue.worker binding 해석 누락"
ok "RF-33/RF-34: Reverb publish + Cloud Tasks dequeue fail-closed"

if [[ "${FAIL}" -ne 0 ]]; then
  echo "== check-deploy-recurring-guards FAILED — deploy/DEPLOY-RECURRING-FAILURES.md =="
  exit 1
fi

echo "== check-deploy-recurring-guards PASSED =="
