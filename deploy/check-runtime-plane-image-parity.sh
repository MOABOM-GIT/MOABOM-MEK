#!/usr/bin/env bash
# Cloud Run web/queue plane 이 동일한 운영 이미지 태그를 사용하는지 확인합니다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/image-tag.sh
source "${ROOT}/deploy/lib/image-tag.sh"

PROJECT="$(moabom_gcp_project)"
REGION="$(moabom_gcp_region)"
WEB_SERVICE="$(moabom_gcp_cloud_run_service)"
QUEUE_SERVICE="${MOABOM_QUEUE_SERVICE:-mobaom-queue}"
EXPECTED_IMAGE="$(moabom_container_image)"
ENV_FILE="${ROOT}/deploy/production.env.yaml"

if ! grep -qE '^MOABOM_QUEUE_PLANE_MODE: "?active"?$' "${ENV_FILE}"; then
  echo "SKIP: queue plane inactive"
  exit 0
fi

service_image() {
  gcloud run services describe "$1" \
    --project="${PROJECT}" \
    --region="${REGION}" \
    --format='value(spec.template.spec.containers[0].image)'
}

WEB_IMAGE="$(service_image "${WEB_SERVICE}")"
QUEUE_IMAGE="$(service_image "${QUEUE_SERVICE}")"

echo "web image:   ${WEB_IMAGE}"
echo "queue image: ${QUEUE_IMAGE}"
echo "expected:    ${EXPECTED_IMAGE}"

if [[ "${WEB_IMAGE}" != "${EXPECTED_IMAGE}" ]]; then
  echo "ERROR: web plane image mismatch" >&2
  exit 1
fi
if [[ "${QUEUE_IMAGE}" != "${EXPECTED_IMAGE}" ]]; then
  echo "ERROR: queue plane image mismatch" >&2
  exit 1
fi

echo "OK: Cloud Run web/queue image parity"
