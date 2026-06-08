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
SYNC_CMD="${APP}/modules/moabom-system/src/Console/Commands/SaasSyncTemplateLayoutsCommand.php"
PROVISION="${APP}/modules/moabom-system/src/Saas/TenantProvisionArtisanRunner.php"
CRJ="${ROOT}/deploy/lib/cloud-run-artisan-job.sh"
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

if grep -q "sync-template-layouts '\*'" "${ENTRY}" 2>/dev/null \
  || grep -q 'sync-template-layouts "\*"' "${ENTRY}" 2>/dev/null; then
  fail "RF-12: entrypoint 에 sync-template-layouts '*' — slug 생략 필요"
else
  ok "RF-12: entrypoint sync slug * 미사용"
fi

grep -q 'MOABOM_SYNC_TEMPLATE_LAYOUTS' "${ENTRY}" \
  || fail "RF-08: entrypoint MOABOM_SYNC_TEMPLATE_LAYOUTS 가드 없음"
grep -q 'moabom:saas:sync-template-layouts' "${ENTRY}" \
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

[[ -x "${ROOT}/deploy/run-layout-sync-job.sh" ]] \
  || fail "RF-13: run-layout-sync-job.sh 없음 또는 실행 불가"
grep -q 'moabom:saas:sync-module-layouts' "${ROOT}/deploy/run-layout-sync-job.sh" \
  || fail "RF-14b: run-layout-sync-job.sh 에 moabom:saas:sync-module-layouts 없음"
ok "RF-13/RF-14b: run-layout-sync-job.sh (template + module layouts)"

grep -q 'moabom:saas:sync-module-layouts' "${ENTRY}" \
  || fail "RF-14b: entrypoint 에 moabom:saas:sync-module-layouts 없음"
grep -q 'MOABOM_SYNC_MODULE_LAYOUTS' "${ENTRY}" \
  || fail "RF-14b: entrypoint MOABOM_SYNC_MODULE_LAYOUTS 가드 없음"
ok "RF-14b: entrypoint module layout sync"

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

# RF-20: WSL 호스트 npm 으로 moabom-basic 로컬 빌드 금지 가드
BASIC_DIR="${APP}/templates/moabom-basic"
BASIC_PKG="${BASIC_DIR}/package.json"
BASIC_GUARD="${BASIC_DIR}/scripts/guard-no-host-build.cjs"
[[ -f "${BASIC_GUARD}" ]] \
  || fail "RF-20: moabom-basic guard-no-host-build.cjs 없음 (호스트 로컬 빌드 차단 가드)"
grep -q '"prebuild"[[:space:]]*:[[:space:]]*"node scripts/guard-no-host-build.cjs"' "${BASIC_PKG}" \
  || fail "RF-20: moabom-basic package.json prebuild 가드 미연결"
grep -q '"predev"[[:space:]]*:[[:space:]]*"node scripts/guard-no-host-build.cjs"' "${BASIC_PKG}" \
  || fail "RF-20: moabom-basic package.json predev 가드 미연결"
ok "RF-20: moabom-basic 호스트 로컬 빌드 가드 (prebuild/predev)"

if [[ "${FAIL}" -ne 0 ]]; then
  echo "== check-deploy-recurring-guards FAILED — deploy/DEPLOY-RECURRING-FAILURES.md =="
  exit 1
fi

echo "== check-deploy-recurring-guards PASSED =="
