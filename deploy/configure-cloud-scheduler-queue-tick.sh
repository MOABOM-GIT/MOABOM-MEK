#!/usr/bin/env bash
# private queue service의 Laravel scheduler를 매분 push 호출한다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/gcp-env.sh
source "${ROOT}/deploy/lib/gcp-env.sh"

PROJECT="$(moabom_gcp_project)"
REGION="$(moabom_gcp_region)"
QUEUE_SERVICE="${MOABOM_QUEUE_SERVICE:-mobaom-queue}"
JOB_NAME="${MOABOM_SCHEDULER_JOB:-moabom-queue-schedule-tick}"
SERVICE_ACCOUNT="${MOABOM_QUEUE_TASK_SERVICE_ACCOUNT:-moabom-run@${PROJECT}.iam.gserviceaccount.com}"
gcloud services enable cloudscheduler.googleapis.com \
  --project="${PROJECT}" \
  --quiet
QUEUE_URL="$(
  gcloud run services describe "${QUEUE_SERVICE}" \
    --region="${REGION}" \
    --project="${PROJECT}" \
    --format='value(status.url)'
)"
URI="${QUEUE_URL}/api/modules/moabom-system/internal/scheduler/tick"

if gcloud scheduler jobs describe "${JOB_NAME}" \
  --location="${REGION}" \
  --project="${PROJECT}" >/dev/null 2>&1; then
  action=update
else
  action=create
fi

gcloud scheduler jobs "${action}" http "${JOB_NAME}" \
  --location="${REGION}" \
  --project="${PROJECT}" \
  --schedule='* * * * *' \
  --time-zone='Asia/Seoul' \
  --uri="${URI}" \
  --http-method=POST \
  --oidc-service-account-email="${SERVICE_ACCOUNT}" \
  --oidc-token-audience="${QUEUE_URL}" \
  --attempt-deadline=180s

echo "scheduler ready: ${JOB_NAME} -> ${URI}"
