#!/usr/bin/env bash
# admin routes ↔ module layout JSON 정합성 (404 Layout not found 재발 방지)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODULES="${ROOT}/app/modules"
fail() { echo "FAIL: $*" >&2; exit 1; }

echo "== check-module-layout-sync-ssot =="

# SaasSyncModuleLayoutsCommand 기본 --module=* (layout 보유 모듈 전체)
SYNC_CMD="${ROOT}/app/modules/moabom-system/src/Console/Commands/SaasSyncModuleLayoutsCommand.php"
grep -q 'ModuleLayoutSyncCatalog::resolveModuleOption' "${SYNC_CMD}" \
  || fail "SaasSyncModuleLayoutsCommand 가 ModuleLayoutSyncCatalog 미사용"

CATALOG="${ROOT}/app/modules/moabom-system/src/Saas/ModuleLayoutSyncCatalog.php"
[[ -f "${CATALOG}" ]] || fail "ModuleLayoutSyncCatalog.php 없음"

# admin routes 의 layout 필드마다 resources/layouts/admin/{name}.json 존재
route_gaps=0
while IFS= read -r admin_routes; do
  module_dir="$(dirname "$(dirname "$(dirname "${admin_routes}")")")"
  module_id="$(basename "${module_dir}")"
  routes_json="$(python3 - "${admin_routes}" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as f:
    data = json.load(f)
for route in data.get('routes', []):
    layout = route.get('layout')
    if layout:
        print(layout)
PY
)"
  while IFS= read -r layout_name; do
    [[ -z "${layout_name}" ]] && continue
    layout_file="${module_dir}/resources/layouts/admin/${layout_name}.json"
    if [[ ! -f "${layout_file}" ]]; then
      echo "GAP: ${module_id} route layout=${layout_name} → missing ${layout_file}" >&2
      route_gaps=$((route_gaps + 1))
    fi
  done <<< "${routes_json}"
done < <(find "${MODULES}" -path '*/resources/routes/admin.json' -type f 2>/dev/null | sort)

if [[ "${route_gaps}" -gt 0 ]]; then
  fail "admin route ↔ layout JSON 불일치 ${route_gaps}건"
fi

# Phase G SSOT — moabom-apps generated admin
[[ -f "${MODULES}/moabom-apps/resources/layouts/admin/admin_generated_apps.json" ]] \
  || fail "moabom-apps admin_generated_apps.json 없음"

# hospital-default: module_refresh_layout 단독 moabom-system 화이트리스트 금지 (자동 catalog 사용)
PKG="${ROOT}/app/modules/moabom-system/database/saas/packages/hospital-default.json"
if grep -q '"module_refresh_layout"' "${PKG}"; then
  if grep -A5 '"module_refresh_layout"' "${PKG}" | grep -q '"moabom-system"' \
    && ! grep -A10 '"module_refresh_layout"' "${PKG}" | grep -q '"moabom-apps"'; then
    fail "hospital-default module_refresh_layout 가 moabom-system 만 지정 (moabom-apps 누락 또는 키 제거 필요)"
  fi
fi

grep -q 'PlatformModuleLayoutReconciler' "${SYNC_CMD}" \
  || fail "SaasSyncModuleLayoutsCommand 가 PlatformModuleLayoutReconciler 미사용"
grep -q 'reconcile-platform-module-layouts' "${ROOT}/deploy/run-platform-module-layout-reconcile-job.sh" \
  || fail "run-platform-module-layout-reconcile-job.sh 없음 또는 reconcile 커맨드 미호출"
"${ROOT}/scripts/check-realtime-vm-layout-bindings.sh"

echo "OK: admin route layouts + module sync catalog SSOT"
echo "== check-module-layout-sync-ssot PASSED =="
