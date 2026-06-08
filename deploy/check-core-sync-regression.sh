#!/usr/bin/env bash
# Gate-4: core:update 이후 권한/메뉴 sync 회귀 사전 점검
# Usage: bash deploy/check-core-sync-regression.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${ROOT}/app"
FAIL=0

fail() { echo "FAIL: $*"; FAIL=1; }
ok()   { echo "OK:   $*"; }
info() { echo "INFO: $*"; }

CORE_UPDATE_CMD="${APP}/app/Console/Commands/Core/CoreUpdateCommand.php"
CORE_UPDATE_SVC="${APP}/app/Services/CoreUpdateService.php"
CORE_CONFIG="${APP}/config/core.php"
API_ROUTES="${APP}/routes/api.php"

echo "== check-core-sync-regression =="

[[ -f "${CORE_UPDATE_CMD}" ]] || fail "CoreUpdateCommand.php 없음"
[[ -f "${CORE_UPDATE_SVC}" ]] || fail "CoreUpdateService.php 없음"
[[ -f "${CORE_CONFIG}" ]] || fail "config/core.php 없음"
[[ -f "${API_ROUTES}" ]] || fail "routes/api.php 없음"

# Gate-4.1: CoreUpdateCommand 은 직접 sync 호출 대신 reloadCoreConfigAndResync 경유
if grep -Eq "reloadCoreConfigAndResync\(\)" "${CORE_UPDATE_CMD}"; then
  ok "CoreUpdateCommand: reloadCoreConfigAndResync 호출 존재"
else
  fail "CoreUpdateCommand: reloadCoreConfigAndResync 호출 누락"
fi

if grep -Eq -- "->syncCoreRolesAndPermissions\(|->syncCoreMenus\(" "${CORE_UPDATE_CMD}"; then
  fail "CoreUpdateCommand: direct syncCore* 호출 발견 (stale config 회귀 위험)"
else
  ok "CoreUpdateCommand: direct syncCore* 호출 없음"
fi

# Gate-4.2: CoreUpdateService 의 sync 핵심 메서드 존재
if grep -Eq "function syncCoreRolesAndPermissions\(" "${CORE_UPDATE_SVC}" && \
   grep -Eq "function syncCoreMenus\(" "${CORE_UPDATE_SVC}" && \
   grep -Eq "function reloadCoreConfigAndResync\(" "${CORE_UPDATE_SVC}"; then
  ok "CoreUpdateService: sync/reload 메서드 존재"
else
  fail "CoreUpdateService: sync/reload 메서드 일부 누락"
fi

# Gate-4.3: core 설정 SSoT 키 존재 (권한/역할/메뉴)
if grep -Eq "'permissions'[[:space:]]*=>[[:space:]]*\[" "${CORE_CONFIG}" && \
   grep -Eq "'roles'[[:space:]]*=>[[:space:]]*\[" "${CORE_CONFIG}" && \
   grep -Eq "'menus'[[:space:]]*=>[[:space:]]*\[" "${CORE_CONFIG}"; then
  ok "config/core.php: permissions/roles/menus 키 존재"
else
  fail "config/core.php: permissions/roles/menus 키 누락"
fi

# Gate-4.4: 관리자 라우트 표면 존재 (권한/메뉴 조회 API)
if grep -Eq "api\.admin\.roles\.index" "${API_ROUTES}" && \
   grep -Eq "api\.admin\.permissions\.index" "${API_ROUTES}" && \
   grep -Eq "api\.admin\.menus\.index" "${API_ROUTES}"; then
  ok "routes/api.php: roles/permissions/menus 조회 라우트 존재"
else
  fail "routes/api.php: roles/permissions/menus 조회 라우트 누락"
fi

# Gate-4.5: 핵심 core 권한 식별자 존재
if grep -Eq "core\.permissions\.read" "${CORE_CONFIG}" && \
   grep -Eq "core\.menus\.read" "${CORE_CONFIG}" && \
   grep -Eq "core\.settings\.read" "${CORE_CONFIG}"; then
  ok "config/core.php: 핵심 권한 식별자 존재"
else
  fail "config/core.php: 핵심 권한 식별자 누락"
fi

# 옵션: docker app 실행 시 route:list 기반 실체 확인
if docker compose -f "${ROOT}/docker-compose.yml" ps --status running app 2>/dev/null | grep -q app; then
  info "docker app 실행 감지: route:list 기반 추가 점검"
  if docker compose -f "${ROOT}/docker-compose.yml" exec -u www-data app sh -lc "test -f /var/www/html/artisan"; then
    if docker compose -f "${ROOT}/docker-compose.yml" exec -u www-data app sh -lc "cd /var/www/html && php artisan route:list" | \
      grep -E "api\.admin\.(roles\.index|permissions\.index|menus\.index)" >/dev/null; then
      ok "route:list: admin roles/permissions/menus 엔드포인트 노출 확인"
    else
      fail "route:list: admin roles/permissions/menus 엔드포인트 미검출"
    fi
  else
    info "컨테이너 /var/www/html/artisan 부재: route:list 점검 경고 처리"
  fi
else
  info "docker app 미실행: route:list 점검 생략"
fi

echo ""
if [[ "${FAIL}" -ne 0 ]]; then
  echo "== FAILED: Gate-4 사전 점검에서 회귀 위험 발견 =="
  exit 1
fi

echo "== PASSED: Gate-4 사전 점검 OK =="
