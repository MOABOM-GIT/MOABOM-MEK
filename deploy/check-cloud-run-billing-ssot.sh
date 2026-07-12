#!/usr/bin/env bash
# Cloud Run Billing SSOT — Request-based (--cpu-throttling) 고정 가드
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FLAGS="${ROOT}/deploy/lib/cloud-run-service-flags.sh"
BUILD_DEPLOY="${ROOT}/deploy/build-and-deploy.sh"
FAIL=0

fail() { echo "FAIL: $*"; FAIL=1; }
ok() { echo "OK:   $*"; }

echo "== check-cloud-run-billing-ssot =="

[[ -f "${FLAGS}" ]] || fail "deploy/lib/cloud-run-service-flags.sh 없음"
# shellcheck source=lib/cloud-run-service-flags.sh
source "${FLAGS}"

if [[ "${MOABOM_CLOUD_RUN_BILLING_MODE}" != "request-based" ]]; then
  fail "MOABOM_CLOUD_RUN_BILLING_MODE=${MOABOM_CLOUD_RUN_BILLING_MODE} — request-based 만 허용"
else
  ok "billing mode SSOT = request-based"
fi

if ! moabom_cloud_run_service_deploy_args | grep -qx -- '--cpu-throttling'; then
  fail "cloud-run-service-flags.sh 에 --cpu-throttling 없음"
fi
if moabom_cloud_run_service_deploy_args | grep -q -- '--no-cpu-throttling'; then
  fail "cloud-run-service-flags.sh 에 --no-cpu-throttling 금지"
fi
ok "deploy args use --cpu-throttling (Request-based)"

if [[ "${MOABOM_CLOUD_RUN_MIN_INSTANCES}" != "0" ]]; then
  fail "MOABOM_CLOUD_RUN_MIN_INSTANCES=${MOABOM_CLOUD_RUN_MIN_INSTANCES} — SSOT=0"
else
  ok "min-instances SSOT = 0"
fi
if [[ "${MOABOM_CLOUD_RUN_MAX_INSTANCES}" != "10" ]]; then
  fail "MOABOM_CLOUD_RUN_MAX_INSTANCES=${MOABOM_CLOUD_RUN_MAX_INSTANCES} — SSOT=10"
else
  ok "max-instances SSOT = 10"
fi
if [[ "${MOABOM_CLOUD_RUN_INGRESS}" != "internal-and-cloud-load-balancing" ]]; then
  fail "MOABOM_CLOUD_RUN_INGRESS=${MOABOM_CLOUD_RUN_INGRESS} — SSOT=internal-and-cloud-load-balancing"
else
  ok "ingress SSOT = internal-and-cloud-load-balancing (LB only)"
fi
if ! moabom_cloud_run_service_deploy_args | grep -qx -- '--min-instances=0'; then
  fail "deploy args --min-instances=0 아님"
fi
if ! moabom_cloud_run_service_deploy_args | grep -qx -- '--max-instances=10'; then
  fail "deploy args --max-instances=10 아님"
fi
if ! moabom_cloud_run_service_deploy_args | grep -qx -- '--ingress=internal-and-cloud-load-balancing'; then
  fail "deploy args --ingress=internal-and-cloud-load-balancing 아님"
fi

if [[ "${MOABOM_CLOUD_RUN_MEMORY}" != "2Gi" ]]; then
  fail "MOABOM_CLOUD_RUN_MEMORY=${MOABOM_CLOUD_RUN_MEMORY} — SSOT=2Gi (FPM8)"
else
  ok "memory SSOT = 2Gi"
fi
if [[ "${MOABOM_CLOUD_RUN_CPU}" != "1" ]]; then
  fail "MOABOM_CLOUD_RUN_CPU=${MOABOM_CLOUD_RUN_CPU} — SSOT=1"
else
  ok "cpu SSOT = 1"
fi
if [[ "${MOABOM_CLOUD_RUN_CONCURRENCY}" != "8" ]]; then
  fail "MOABOM_CLOUD_RUN_CONCURRENCY=${MOABOM_CLOUD_RUN_CONCURRENCY} — SSOT=8 (FPM max_children)"
else
  ok "concurrency SSOT = 8"
fi
if ! moabom_cloud_run_service_deploy_args | grep -qx -- '--memory=2Gi'; then
  fail "deploy args --memory=2Gi 아님"
fi
if ! moabom_cloud_run_service_deploy_args | grep -qx -- '--cpu=1'; then
  fail "deploy args --cpu=1 아님"
fi
if ! moabom_cloud_run_service_deploy_args | grep -qx -- '--concurrency=8'; then
  fail "deploy args --concurrency=8 아님"
fi

[[ -f "${BUILD_DEPLOY}" ]] || fail "build-and-deploy.sh 없음"
if grep -q -- '--no-cpu-throttling' "${BUILD_DEPLOY}"; then
  fail "build-and-deploy.sh 에 --no-cpu-throttling 잔존 — Instance-based 금지"
fi
if ! grep -q 'cloud-run-service-flags.sh' "${BUILD_DEPLOY}"; then
  fail "build-and-deploy.sh 가 cloud-run-service-flags.sh SSOT 미사용"
fi
if ! grep -q 'moabom_cloud_run_service_deploy_args' "${BUILD_DEPLOY}"; then
  fail "build-and-deploy.sh 가 moabom_cloud_run_service_deploy_args 미호출"
fi
ok "build-and-deploy.sh → cloud-run-service-flags SSOT"

if [[ "${MOABOM_BILLING_CHECK_LIVE:-0}" != "1" ]]; then
  ok "live service 검사 생략 (배포 후: MOABOM_BILLING_CHECK_LIVE=1)"
elif command -v gcloud >/dev/null 2>&1; then
  # shellcheck source=lib/gcp-env.sh
  source "${ROOT}/deploy/lib/gcp-env.sh"
  SERVICE="$(moabom_gcp_cloud_run_service)"
  REGION="$(moabom_gcp_region)"
  PROJECT="$(moabom_gcp_project)"
  LIVE_JSON="$(
    gcloud run services describe "${SERVICE}" \
      --region="${REGION}" \
      --project="${PROJECT}" \
      --format=json \
      2>/dev/null || true
  )"
  THROTTLE="$(
    printf '%s' "${LIVE_JSON}" | python3 -c "
import json, sys
d = json.load(sys.stdin)
a = d.get('spec', {}).get('template', {}).get('metadata', {}).get('annotations', {})
print(a.get('run.googleapis.com/cpu-throttling', ''))
" 2>/dev/null || true
  )"
  MIN_INST="$(
    printf '%s' "${LIVE_JSON}" | python3 -c "
import json, sys
d = json.load(sys.stdin)
a = d.get('spec', {}).get('template', {}).get('metadata', {}).get('annotations', {})
v = a.get('autoscaling.knative.dev/minScale')
print('0' if v in (None, '', '0') else v)
" 2>/dev/null || true
  )"
  MAX_INST="$(
    printf '%s' "${LIVE_JSON}" | python3 -c "
import json, sys
d = json.load(sys.stdin)
a = d.get('spec', {}).get('template', {}).get('metadata', {}).get('annotations', {})
print(a.get('autoscaling.knative.dev/maxScale', ''))
" 2>/dev/null || true
  )"
  if [[ -z "${THROTTLE}" ]]; then
    ok "live service: cpu-throttling annotation absent (= Request-based default)"
  elif [[ "${THROTTLE}" == "true" ]]; then
    ok "live service: cpu-throttling=true (Request-based)"
  else
    fail "live service: cpu-throttling=${THROTTLE} — Request-based(--cpu-throttling) 필요"
  fi
  if [[ "${MIN_INST}" == "0" ]]; then
    ok "live service: min-instances=0"
  else
    fail "live service: minScale=${MIN_INST:-unset} — SSOT min-instances=0"
  fi
  if [[ "${MAX_INST}" == "10" ]]; then
    ok "live service: max-instances=10"
  else
    fail "live service: maxScale=${MAX_INST:-unset} — SSOT max-instances=10"
  fi
else
  ok "gcloud 없음 — live service 검사 생략"
fi

if [[ "${FAIL}" -ne 0 ]]; then
  echo "== check-cloud-run-billing-ssot FAILED =="
  exit 1
fi

echo "== check-cloud-run-billing-ssot PASSED =="
