#!/usr/bin/env bash
# _bundled 의존 회귀 점검 (활성 moabom 코드 경로 기준)
# Usage: bash deploy/check-bundled-detach-regression.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${ROOT}/app"
FAIL=0

fail() { echo "FAIL: $*"; FAIL=1; }
ok()   { echo "OK:   $*"; }
info() { echo "INFO: $*"; }

echo "== check-bundled-detach-regression =="

scan_path_for_bundled_ref() {
  local path="$1"
  local label="$2"

  if [[ ! -d "${path}" ]]; then
    info "${label}: 대상 경로 없음 (${path})"
    return
  fi

  if grep -RInE "modules/_bundled|plugins/_bundled|templates/_bundled|lang-packs/_bundled" \
    --include="*.php" \
    --include="*.ts" \
    --include="*.tsx" \
    --include="*.js" \
    --include="*.json" \
    --exclude-dir="node_modules" \
    --exclude-dir="dist" \
    --exclude-dir="tests" \
    --exclude-dir="__tests__" \
    "${path}" >/tmp/.bundled_scan_${label}.log 2>/dev/null; then
    fail "${label}: 활성 경로에 *_bundled 경로 참조 존재"
    sed -n '1,20p' "/tmp/.bundled_scan_${label}.log"
  else
    ok "${label}: _bundled 참조 없음"
  fi
}

# 실운영/활성 경로 중심 스캔 (문서/테스트/빌드산출물 제외)
scan_path_for_bundled_ref "${APP}/modules/moabom-system/src" "modules_system_src"
scan_path_for_bundled_ref "${APP}/modules/moabom-system/resources" "modules_system_resources"
scan_path_for_bundled_ref "${APP}/modules/moabom-system/js" "modules_system_js"
scan_path_for_bundled_ref "${APP}/plugins/moabom-auth-hardening/src" "plugins_auth_hardening_src"
scan_path_for_bundled_ref "${APP}/plugins/moabom-auth-hardening/resources" "plugins_auth_hardening_resources"
scan_path_for_bundled_ref "${APP}/plugins/moabom-pwa/src" "plugins_pwa_src"
scan_path_for_bundled_ref "${APP}/plugins/moabom-pwa/resources" "plugins_pwa_resources"
scan_path_for_bundled_ref "${APP}/templates/moabom-admin_basic/src" "templates_admin_src"
scan_path_for_bundled_ref "${APP}/templates/moabom-admin_basic/layouts" "templates_admin_layouts"
scan_path_for_bundled_ref "${APP}/templates/moabom-basic/src" "templates_basic_src"
scan_path_for_bundled_ref "${APP}/templates/moabom-basic/layouts" "templates_basic_layouts"

# 참고 정보: core:update 대상에 _bundled 경로가 포함되어 있는지 출력 (정상 동작 맥락용)
if grep -Eq "lang-packs/_bundled|modules/_bundled|plugins/_bundled|templates/_bundled" "${APP}/config/app.php"; then
  info "config/app.php update.targets에 *_bundled 포함 (core:update 동기화 대상)"
else
  fail "config/app.php update.targets에서 *_bundled 누락 (업데이트 동작 확인 필요)"
fi

echo ""
if [[ "${FAIL}" -ne 0 ]]; then
  echo "== FAILED: _bundled 의존 회귀 또는 설정 이상 존재 =="
  exit 1
fi

echo "== PASSED: 활성 moabom 경로 _bundled 의존 0 =="
