#!/usr/bin/env bash
# JobQueued push hook 롤백: web은 legacy로 복원하고, queue service의 5분 reconcile은 유지한다.
# request-based/min=0에서 web background worker만 믿지 않기 위한 안전 경로다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/gcp-env.sh
source "${ROOT}/deploy/lib/gcp-env.sh"

PROJECT="$(moabom_gcp_project)"
REGION="$(moabom_gcp_region)"
WEB_SERVICE="$(moabom_gcp_cloud_run_service)"
QUEUE_SERVICE="${MOABOM_QUEUE_SERVICE:-mobaom-queue}"
gcloud run services update "${WEB_SERVICE}" \
  --region="${REGION}" \
  --project="${PROJECT}" \
  --update-env-vars=MOABOM_QUEUE_PLANE_MODE=legacy

echo "web JobQueued hook rolled back to legacy"
echo "queue service ${QUEUE_SERVICE} remains active; scheduler reconcile wakes pending DB jobs every 5 minutes"
