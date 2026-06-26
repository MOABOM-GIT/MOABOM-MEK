#!/usr/bin/env bash
# Cloud Scheduler — min=0 콜드스타트 완화용 주기적 워밍 (5분마다 /public/ready)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/gcp-env.sh
source "${ROOT}/deploy/lib/gcp-env.sh"

PROJECT="$(moabom_gcp_project)"
REGION="$(moabom_gcp_region)"
JOB_NAME="${MOABOM_WARMUP_SCHEDULER_JOB:-moabom-cloudrun-warmup}"
SCHEDULE="${MOABOM_WARMUP_SCHEDULE:-*/5 * * * *}"
WARMUP_URL="${MOABOM_WARMUP_URL:-https://mek360.com/api/modules/moabom-system/public/ready}"
TIME_ZONE="${MOABOM_WARMUP_TIMEZONE:-Asia/Seoul}"

echo "== setup-cloud-scheduler-warmup =="
echo "    project=${PROJECT} region=${REGION} job=${JOB_NAME}"
echo "    schedule=${SCHEDULE} url=${WARMUP_URL}"

gcloud services enable cloudscheduler.googleapis.com --project="${PROJECT}" >/dev/null 2>&1 || true

if gcloud scheduler jobs describe "${JOB_NAME}" \
  --location="${REGION}" \
  --project="${PROJECT}" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "${JOB_NAME}" \
    --location="${REGION}" \
    --project="${PROJECT}" \
    --schedule="${SCHEDULE}" \
    --time-zone="${TIME_ZONE}" \
    --uri="${WARMUP_URL}" \
    --http-method=GET \
    --attempt-deadline=120s \
    --description="Moabom Cloud Run warmup (min=0 cold start mitigation)"
else
  gcloud scheduler jobs create http "${JOB_NAME}" \
    --location="${REGION}" \
    --project="${PROJECT}" \
    --schedule="${SCHEDULE}" \
    --time-zone="${TIME_ZONE}" \
    --uri="${WARMUP_URL}" \
    --http-method=GET \
    --attempt-deadline=120s \
    --description="Moabom Cloud Run warmup (min=0 cold start mitigation)"
fi

echo "== setup-cloud-scheduler-warmup done =="
