#!/usr/bin/env bash
# v7 성공 기준 HTTP 스모크 (배포 직후)
set -euo pipefail

URL="${1:-}"
if [[ -z "${URL}" ]]; then
  ROOT="${ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
  ENV_FILE="${ROOT}/deploy/production.env.yaml"
  if [[ -f "${ENV_FILE}" ]] && grep -qE '^MOABOM_SAAS_ENABLED: "true"' "${ENV_FILE}"; then
    URL="https://mek360.com"
  else
    # shellcheck source=lib/gcp-env.sh
    source "${ROOT}/deploy/lib/gcp-env.sh"
    URL="$(gcloud run services describe "$(moabom_gcp_cloud_run_service)" \
      --region="$(moabom_gcp_region)" \
      --project="$(moabom_gcp_project)" \
      --format='value(status.url)' 2>/dev/null)"
  fi
fi

if [[ -z "${URL}" ]]; then
  echo "ERROR: URL 없음. 인자로 전달: $0 https://..."
  exit 1
fi

echo "==> Smoke ${URL}"

SMOKE_DIR="$(mktemp -d)"
trap 'rm -rf "${SMOKE_DIR}"' EXIT

# path expect [body_file] — body_file 지정 시 응답 본문 보존 (shell-boot 검증용)
check() {
  local path="$1"
  local expect="${2:-200}"
  local body_file="${3:-${SMOKE_DIR}/last.json}"
  local code attempt max_attempts=5
  for attempt in $(seq 1 "${max_attempts}"); do
    code="$(curl -sS -o "${body_file}" -w "%{http_code}" -H "Accept: application/json" "${URL}${path}" 2>/dev/null || echo "000")"
    if [[ "${code}" == "${expect}" ]]; then
      echo "OK   ${path} HTTP ${code}"
      return 0
    fi
    if [[ "${attempt}" -lt "${max_attempts}" ]]; then
      sleep 3
    fi
  done
  echo "FAIL ${path} HTTP ${code} (expected ${expect}, ${max_attempts} attempts)"
  head -c 200 "${body_file}" 2>/dev/null; echo
  return 1
}

SHELL_BOOT_BODY="${SMOKE_DIR}/shell-boot.json"

FAIL=0
check "/api/modules/moabom-system/public/frontend-defaults" 200 || FAIL=1
check "/api/modules/moabom-social-auth/providers" 200 || FAIL=1
check "/api/modules/moabom-system/public/shell-boot?template=moabom-basic&scope=shell" 200 "${SHELL_BOOT_BODY}" || FAIL=1
check "/api/plugins/moabom-weather/weather/current?lat=37.5&lon=127.0&lang=ko" 200 || FAIL=1
check "/api/plugins/moabom-weather/weather/geolocate" 200 || FAIL=1

# 분리 모듈 라우트 — DB active + ModuleRouteServiceProvider 등록 확인 (401 = 라우트·auth 정상)
check_auth_or_ok() {
  local path="$1"
  local label="$2"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" -H "Accept: application/json" "${URL}${path}" 2>/dev/null || echo "000")"
  if [[ "${code}" == "401" || "${code}" == "200" ]]; then
    echo "OK   ${label} HTTP ${code} (route registered)"
    return 0
  fi
  echo "FAIL ${label} HTTP ${code} (expected 401 or 200 — inactive module → 404)"
  return 1
}
check_auth_or_ok "/api/modules/moabom-cpap/apps/cpap-mask/measurements/latest" "cpap latest" || FAIL=1
check_auth_or_ok "/api/modules/moabom-personalization/user/activities?type=all&limit=1" "personalization activities" || FAIL=1
# 전환기 compat — dist 가 구 URL 이면 401/200 (404 금지)
check_auth_or_ok "/api/modules/moabom-system/user/activities?type=all&limit=1" "legacy activities compat" || FAIL=1

if [[ "${FAIL}" -ne 0 ]]; then
  echo "ERROR: 스모크 실패 — Cloud Run 로그 확인"
  exit 1
fi

if command -v python3 >/dev/null; then
  python3 -c "
import json
import sys
path = sys.argv[1]
d = json.load(open(path))
keys = list((d.get('data') or {}).keys())
need = {'defaults', 'shell_routes', 'social_providers'}
missing = need - set(keys)
if missing:
    raise SystemExit(f'shell-boot data missing: {missing}')
print('OK   shell-boot payload keys:', ', '.join(sorted(keys)))
" "${SHELL_BOOT_BODY}" || FAIL=1
fi

if [[ "${FAIL}" -ne 0 ]]; then
  echo "ERROR: shell-boot 페이로드 검증 실패"
  exit 1
fi

echo "==> 스모크 통과"

ENV_FILE="${ROOT:-$(cd "$(dirname "$0")/.." && pwd)}/deploy/production.env.yaml"
if [[ -f "${ENV_FILE}" ]] && grep -qE '^MOABOM_SAAS_ENABLED: "true"' "${ENV_FILE}"; then
  echo "==> SaaS wildcard LB smoke (PHASE1 §11)"
  bash "$(cd "$(dirname "$0")/.." && pwd)/deploy/saas-wildcard-smoke.sh" || exit 1
  echo "==> SaaS tenant shell-boot smoke"
  sleep 2
  bash "$(cd "$(dirname "$0")/.." && pwd)/deploy/smoke-saas-tenant-shell-boot.sh" || exit 1
  echo "==> SaaS tenant isolation (DoD-7)"
  DEPLOY=1 bash "$(cd "$(dirname "$0")/.." && pwd)/deploy/e2e-tenant-isolation-dod.sh" || exit 1
  echo "==> SaaS platform hospitals smoke"
  bash "$(cd "$(dirname "$0")/.." && pwd)/deploy/saas-platform-hospitals-smoke.sh" || exit 1
  echo "==> SaaS tenant admin template smoke"
  bash "$(cd "$(dirname "$0")/.." && pwd)/deploy/saas-tenant-admin-smoke.sh" || exit 1
  echo "==> moabom-admin_basic SSOT (DoD-8)"
  bash "$(cd "$(dirname "$0")/.." && pwd)/deploy/check-moabom-admin-basic-ssot.sh" || exit 1
  echo "==> SNS OAuth broker smoke (Phase 5)"
  bash "$(cd "$(dirname "$0")/.." && pwd)/deploy/smoke-social-auth.sh" || exit 1
fi

exit 0
