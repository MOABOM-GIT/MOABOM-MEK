#!/usr/bin/env bash
# PROJECT-ADMIN-SAAS-REBUILD §8 DoD-8 — moabom-admin_basic SSOT (core:update 후에도 Moabom admin 유지)
#
# sirsoft-admin_basic = upstream mirror only. 운영 활성 admin = moabom-admin_basic.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${ROOT}/app"
ACTIVE_ADMIN="${APP}/templates/moabom-admin_basic"
PACKAGE="${APP}/modules/moabom-system/database/saas/packages/hospital-default.json"
DOCKERFILE="${ROOT}/deploy/Dockerfile"
FAIL=0

fail() { echo "FAIL: $*"; FAIL=1; }
ok() { echo "OK:   $*"; }

echo "== check-moabom-admin-basic-ssot (DoD-8) =="

[[ -d "${ACTIVE_ADMIN}" ]] || fail "활성 moabom-admin_basic 없음"
[[ -f "${ACTIVE_ADMIN}/package.json" ]] || fail "moabom-admin_basic package.json 없음"
[[ -f "${ACTIVE_ADMIN}/vite.config.ts" ]] || fail "moabom-admin_basic vite.config.ts 없음"
grep -q 'flushFormBeforeSave' "${ACTIVE_ADMIN}/src/handlers/index.ts" \
  || fail "moabom-admin_basic src handlers 에 flushFormBeforeSave 등록 없음"
grep -q "entryFileNames: 'js/components.iife.js'" "${ACTIVE_ADMIN}/vite.config.ts" \
  || fail "moabom-admin_basic vite output 이 dist/js/components.iife.js 계약과 다름"
grep -qE 'templates/moabom-admin_basic.*npm (ci|run build)' "${DOCKERFILE}" 2>/dev/null \
  || fail "Dockerfile asset stage 에 moabom-admin_basic 빌드 단계 없음"
TAB_INFO="${ACTIVE_ADMIN}/layouts/partials/admin_settings/_tab_info.json"
grep -q 'memory_usage?.used' "${TAB_INFO}" \
  || fail "_tab_info memory_usage — used/total/percentage 필드 바인딩 누락 (React #31)"
grep -q 'memory_usage ??' "${TAB_INFO}" \
  && fail "_tab_info memory_usage 객체 직접 렌더 — React #31" || true
ok "moabom-admin_basic src + Cloud Build dist 계약 + system info memory binding"

# NOTE: _bundled 전체 parity 는 강제하지 않음 (G7 업스트림 준비 전환 — 2026-06-07).
#   - moabom-admin_basic 은 활성 templates/moabom-admin_basic 가 SSOT.
#   - 단, G7 #408 시맨틱 CSS 는 g7-semantic.css 로 동기화 의무
#     (sirsoft-admin_basic main.css → deploy/sync-g7-admin-semantic-css.sh).
chmod +x "${ROOT}/deploy/sync-g7-admin-semantic-css.sh" 2>/dev/null || true
if ! "${ROOT}/deploy/sync-g7-admin-semantic-css.sh" --check --allow-missing-upstream; then
  fail "g7-semantic.css upstream drift — bash deploy/sync-g7-admin-semantic-css.sh"
else
  ok "g7-semantic.css ↔ sirsoft-admin_basic main.css (or SKIP if upstream absent)"
fi

grep -q '"moabom-admin_basic"' "${PACKAGE}" \
  || fail "hospital-default package 에 moabom-admin_basic 없음"
grep -q '"active_admin_template": "moabom-admin_basic"' "${PACKAGE}" \
  || fail "hospital-default active_admin_template ≠ moabom-admin_basic"
ok "provision package → moabom-admin_basic active admin"

# 코어 app/app 수정 금지 — Moabom admin 커스텀은 templates/modules 에만
if grep -rq 'HomeBackgroundManager' "${APP}/app/" 2>/dev/null; then
  fail "G7 코어 app/app 에 Moabom admin 위젯 — core:update 소멸 위험"
fi
ok "Moabom admin 커스텀은 코어 app/app 밖"

if [[ "${FAIL}" -ne 0 ]]; then
  echo "== check-moabom-admin-basic-ssot FAILED =="
  exit 1
fi

echo "== check-moabom-admin-basic-ssot PASSED (DoD-8) =="
