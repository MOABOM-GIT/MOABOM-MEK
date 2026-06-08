#!/usr/bin/env bash
# G7 업데이트 전 회귀 점검: 코어 2파일 + 모듈 주입 가드 정합성
# Usage: bash deploy/check-g7-core-guard-regression.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${ROOT}/app"
FAIL=0

fail() { echo "FAIL: $*"; FAIL=1; }
ok()   { echo "OK:   $*"; }

SETTINGS_SERVICE="${APP}/app/Services/SettingsService.php"
IDENTITY_MW="${APP}/app/Http/Middleware/EnforceIdentityPolicy.php"
CORE_CONFIG="${APP}/config/core.php"
MOABOM_PROVIDER="${APP}/modules/moabom-system/src/Providers/SystemServiceProvider.php"

echo "== check-g7-core-guard-regression =="

[[ -f "${SETTINGS_SERVICE}" ]] || fail "SettingsService.php 없음"
[[ -f "${IDENTITY_MW}" ]] || fail "EnforceIdentityPolicy.php 없음"
[[ -f "${CORE_CONFIG}" ]] || fail "config/core.php 없음"
[[ -f "${MOABOM_PROVIDER}" ]] || fail "SystemServiceProvider.php 없음"

# Gate-2.1: 코어 SettingsService 가 하드코딩 대신 주입 포인트 사용
if grep -Eq "config\('core\.config_clear_guards'" "${SETTINGS_SERVICE}"; then
  ok "SettingsService: core.config_clear_guards 주입점 사용"
else
  fail "SettingsService: core.config_clear_guards 주입점 누락"
fi

if grep -Eq "TenantContext|moabom-system\.saas\.enabled" "${SETTINGS_SERVICE}"; then
  fail "SettingsService: Moabom 하드코딩 재유입(TenantContext/moabom-system.saas.enabled)"
else
  ok "SettingsService: Moabom 하드코딩 없음"
fi

# Gate-2.2: 코어 EnforceIdentityPolicy 가 하드코딩 경로 대신 주입 포인트 사용
if grep -Eq "config\('core\.identity_policy_middleware\.skip_request_patterns'" "${IDENTITY_MW}" && \
   grep -Eq "config\('core\.identity_policy_middleware\.skip_route_names'" "${IDENTITY_MW}"; then
  ok "EnforceIdentityPolicy: skip_* 주입점 사용"
else
  fail "EnforceIdentityPolicy: skip_* 주입점 누락"
fi

if grep -Eq "api/modules/moabom-system/public|api/modules/moabom-social-auth/providers|api\.modules\.moabom-system\.public|api\.plugins\.moabom-social-auth\.providers" "${IDENTITY_MW}"; then
  fail "EnforceIdentityPolicy: Moabom 경로 하드코딩 재유입"
else
  ok "EnforceIdentityPolicy: Moabom 경로 하드코딩 없음"
fi

# Gate-2.3: config/core.php 주입 포인트 키 존재
if grep -Eq "'config_clear_guards'[[:space:]]*=>[[:space:]]*\[\]" "${CORE_CONFIG}" && \
   grep -Eq "'identity_policy_middleware'[[:space:]]*=>[[:space:]]*\[" "${CORE_CONFIG}"; then
  ok "config/core.php: 런타임 주입 포인트 키 존재"
else
  fail "config/core.php: 런타임 주입 포인트 키 누락"
fi

# Gate-2.4: 모듈 Provider 가 코어 주입 로직을 실제 연결
if grep -Eq "configureCoreRuntimeGuards\(\)" "${MOABOM_PROVIDER}" && \
   grep -Eq "core\.config_clear_guards|core\.identity_policy_middleware" "${MOABOM_PROVIDER}"; then
  ok "SystemServiceProvider: configureCoreRuntimeGuards 연결 확인"
else
  fail "SystemServiceProvider: configureCoreRuntimeGuards 연결/주입 누락"
fi

echo ""
if [[ "${FAIL}" -ne 0 ]]; then
  echo "== FAILED: G7 코어 업데이트 전 회귀 위험 있음 =="
  exit 1
fi

echo "== PASSED: Gate-2 코어 가드 정합성 OK =="
