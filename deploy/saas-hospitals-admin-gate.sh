#!/usr/bin/env bash
# SaaS hospitals admin UI — i18n·layout·lang SSOT gate (배포 전/후)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SYS="${ROOT}/app/modules/moabom-system"
LIST="${SYS}/resources/layouts/admin/admin_saas_hospitals.json"
CREATE="${SYS}/resources/layouts/admin/admin_saas_hospital_create.json"
LANG_KO="${SYS}/resources/lang/ko.json"
LANG_EN="${SYS}/resources/lang/en.json"
FAIL=0

fail() { echo "FAIL $1"; FAIL=1; }
ok() { echo "OK   $1"; }

echo "== saas-hospitals-admin-gate =="

for f in "${LIST}" "${CREATE}" "${LANG_KO}" "${LANG_EN}"; do
  [[ -f "${f}" ]] || fail "missing ${f}"
done

if grep -q '\$t:admin\.saas\.hospitals' "${LIST}" "${CREATE}" 2>/dev/null; then
  fail "layout uses \$t:admin.saas.* — must be \$t:moabom-system.admin.saas.*"
else
  ok "layout i18n prefix moabom-system"
fi

grep -q '\$t:moabom-system\.admin\.saas\.hospitals' "${LIST}" \
  && grep -q '\$t:moabom-system\.admin\.saas\.hospitals' "${CREATE}" \
  || fail "layout missing moabom-system.admin.saas.hospitals keys"

# lang JSON 에 필수 키 존재 (admin.saas.hospitals.*)
required_keys=(
  title list_description create_title create_description
  field_slug field_name submit cancel
  empty_title load_error table_name table_host
)
for key in "${required_keys[@]}"; do
  if ! grep -q "\"${key}\"" "${LANG_KO}"; then
    fail "ko.json missing hospitals.${key}"
  fi
done
ok "lang ko/en required keys"

grep -q 'dataSourceId.*hospitals' "${LIST}" || fail "list layout missing hospitals dataSource"
grep -q 'platform/saas/hospitals' "${LIST}" || fail "list layout missing hospitals API endpoint"
grep -q 'submitDisabled' "${CREATE}" || fail "create layout missing submitDisabled computed"
grep -q '"iteration"' "${LIST}" || fail "list layout missing iteration (table rows)"
grep -q '"item_var".*"item"' "${LIST}" || fail "list layout iteration must use item_var item"
if grep -q '"forEach"' "${LIST}"; then
  fail "list layout uses invalid forEach — G7 requires iteration"
fi
grep -q 'moabom:saas:sync-module-layouts' "${ROOT}/deploy/run-layout-sync-job.sh" \
  || fail "run-layout-sync-job.sh missing module layout refresh"
if grep -q '"handler": "confirm"' "${LIST}"; then
  fail "list layout uses handler confirm — moabom-admin_basic 미지원. apiCall.confirm 속성 사용 (RF-17)"
fi
grep -q '"version": "1.2.8"' "${LIST}" \
  || fail "admin_saas_hospitals.json v1.2.8 required (usage labels + navigate create)"
grep -q '"path": "/admin/saas/hospitals/create"' "${LIST}" \
  || fail "list layout must navigate to create (SPA)"
grep -q '"wait_for": \["hospitals"\]' "${LIST}" \
  || fail "list layout missing transition_overlay.wait_for hospitals"
grep -q '"version": "1.2.4"' "${CREATE}" \
  || fail "admin_saas_hospital_create.json v1.2.4 required (logos multipart + navigate)"
grep -q 'multipart/form-data' "${CREATE}" \
  || fail "create layout must POST multipart for logo_light/logo_dark"
grep -q 'logo_light' "${CREATE}" \
  || fail "create layout missing logo_light upload"
grep -q '"handler": "navigate"' "${CREATE}" \
  || fail "create layout must use navigate handler for list return (not href reload)"
grep -q '"enabled": false' "${CREATE}" \
  && fail "create layout must not disable transition_overlay (inherit _admin_base)" || true
grep -q 'field_slug_placeholder' "${LANG_KO}" \
  || fail "ko.json missing field_slug_placeholder"
grep -q 'max-w-3xl mx-auto' "${CREATE}" \
  && fail "create layout must not center page with max-w-3xl mx-auto" || true
grep -q 'table_usage' "${LIST}" \
  || fail "admin_saas_hospitals.json table_usage column required"
grep -q 'action_purge_db' "${LANG_KO}" \
  || fail "ko.json missing Phase E purge i18n keys"
grep -q 'item.usage?.db_runtime_human' "${LIST}" \
  || fail "list layout missing usage.db_runtime_human"
grep -q 'item.usage?.db_baseline_human' "${LIST}" \
  || fail "list layout missing usage.db_baseline_human"
grep -q 'usage_db_total' "${LIST}" \
  && fail "list layout must not show usage_db_total row" || true
grep -q 'action_destroy' "${LIST}" \
  || fail "list layout missing destroy action"
grep -q 'run-saas-phase-e-post-deploy.sh' "${ROOT}/deploy/build-and-deploy.sh" \
  || fail "build-and-deploy.sh missing Phase E post-deploy hook"
ok "layout structure + sync pipeline + Phase E v1.2"

if [[ "${FAIL}" -ne 0 ]]; then
  echo "== saas-hospitals-admin-gate FAILED =="
  exit 1
fi

echo "== saas-hospitals-admin-gate PASSED =="
