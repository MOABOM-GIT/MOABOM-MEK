#!/usr/bin/env bash
# RF-24: PlatformModuleLayoutReconciler SoftDeletes 계약 정적 가드
# 배포 Job 경로에서 Eloquent refresh/findOrFail/delete 가 다시 들어오면 차단.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RECONCILER="${ROOT}/app/modules/moabom-system/src/Saas/PlatformModuleLayoutReconciler.php"
fail() { echo "FAIL: $*" >&2; exit 1; }

echo "== check-module-layout-softdeletes-contract =="

[[ -f "${RECONCILER}" ]] || fail "PlatformModuleLayoutReconciler.php 없음"

# 금지 API — SoftDeletes ModelNotFound / observer 충돌 재발
if grep -nE -- '->refresh\s*\(' "${RECONCILER}" | grep -v 'refreshModuleLayouts'; then
  fail "RF-24: reconciler 에 Eloquent ->refresh() 금지 (SoftDeletes ModelNotFound)"
fi
if grep -nE -- 'findOrFail\s*\(' "${RECONCILER}"; then
  fail "RF-24: reconciler 에 findOrFail 금지"
fi
if grep -nE -- '->forceDelete\s*\(|->delete\s*\(' "${RECONCILER}"; then
  fail "RF-24: reconciler 배포 경로에서 delete/forceDelete 금지 (최신 row overwrite 만)"
fi
if grep -nE -- 'hardDeleteTemplateLayoutRow' "${RECONCILER}"; then
  fail "RF-24: hardDeleteTemplateLayoutRow 재도입 금지"
fi

# 필수: content 검증·쓰기는 DB::table
grep -q -- "DB::table('template_layouts')" "${RECONCILER}" \
  || fail "RF-24: reconciler 가 DB::table('template_layouts') 미사용"
grep -q -- "orderByDesc('id')" "${RECONCILER}" \
  || fail "RF-24: duplicate 시 최신 id 선택(orderByDesc id) 없음"
grep -q -- '삭제 생략' "${RECONCILER}" \
  || fail "RF-24: orphan/stale override 삭제 생략 계약 문구 없음"

# layout-only 재실행 경로
[[ -x "${ROOT}/deploy/run-post-deploy-layout-pipeline.sh" ]] \
  || fail "RF-24: run-post-deploy-layout-pipeline.sh 없음 또는 실행 불가"
grep -q 'run-platform-module-layout-reconcile-job.sh' "${ROOT}/deploy/run-post-deploy-layout-pipeline.sh" \
  || fail "RF-24: layout-only pipeline 에 reconcile Job 없음"
grep -q 'run-layout-sync-job.sh' "${ROOT}/deploy/run-post-deploy-layout-pipeline.sh" \
  || fail "RF-24: layout-only pipeline 에 layout sync Job 없음"
grep -q 'run-post-deploy-layout-pipeline.sh' "${ROOT}/deploy/build-and-deploy.sh" \
  || fail "RF-24: build-and-deploy.sh 가 layout-only pipeline 미호출"
grep -q 'moabom_cloud_run_job_spec_matches\|skip jobs update' "${ROOT}/deploy/lib/cloud-run-artisan-job.sh" \
  || fail "RF-24: cloud-run-artisan-job.sh 에 불필요 jobs update 스킵 없음"

echo "OK: SoftDeletes contract + layout-only pipeline (RF-24)"
echo "== check-module-layout-softdeletes-contract PASSED =="
