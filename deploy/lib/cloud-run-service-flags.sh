#!/usr/bin/env bash
# Cloud Run 서비스(mobaom-container) 배포 플래그 SSOT
#
# Billing: Request-based only (= --cpu-throttling).
#   Instance-based (no-cpu-throttling flag) 는 배포·가드에서 금지.
#   콘솔 Billing → Request-based 와 동일.
#
# Usage:
#   source "${ROOT}/deploy/lib/cloud-run-service-flags.sh"
#   mapfile -t MOABOM_CR_FLAGS < <(moabom_cloud_run_service_deploy_args)
#   gcloud run deploy "${SERVICE}" ... "${MOABOM_CR_FLAGS[@]}"
set -euo pipefail

# SSOT — 변경 시 deploy/check-cloud-run-billing-ssot.sh 가 실패한다.
MOABOM_CLOUD_RUN_BILLING_MODE="request-based"
MOABOM_CLOUD_RUN_MIN_INSTANCES="0"
MOABOM_CLOUD_RUN_MAX_INSTANCES="10"
MOABOM_CLOUD_RUN_STARTUP_PROBE_PATH="/api/modules/moabom-system/public/ready"

moabom_cloud_run_service_deploy_args() {
  if [[ "${MOABOM_CLOUD_RUN_BILLING_MODE}" != "request-based" ]]; then
    echo "ERROR: MOABOM_CLOUD_RUN_BILLING_MODE must be request-based" >&2
    return 1
  fi
  printf '%s\n' \
    --min-instances="${MOABOM_CLOUD_RUN_MIN_INSTANCES}" \
    --max-instances="${MOABOM_CLOUD_RUN_MAX_INSTANCES}" \
    --timeout=3600 \
    --session-affinity \
    --cpu-throttling \
    --startup-probe="tcpSocket.port=8080,initialDelaySeconds=8,timeoutSeconds=4,periodSeconds=5,failureThreshold=24"
}
