#!/usr/bin/env bash
# Cloud Tasks HTTP queue plane — 동일 이미지·동일 Cloud Run 물리 설정, min=0/request-based.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/image-tag.sh
source "${ROOT}/deploy/lib/image-tag.sh"
# shellcheck source=lib/cloud-run-service-flags.sh
source "${ROOT}/deploy/lib/cloud-run-service-flags.sh"

PROJECT="$(moabom_gcp_project)"
REGION="$(moabom_gcp_region)"
SQL="$(moabom_gcp_cloudsql_instance)"
SECRETS="$(moabom_gcp_secret_mappings)"
IMAGE="$(moabom_container_image)"
QUEUE_SERVICE="${MOABOM_QUEUE_SERVICE:-mobaom-queue}"
TASKS_QUEUE="${MOABOM_CLOUD_TASKS_QUEUE:-smartmek}"
RUNTIME_SERVICE_ACCOUNT="${MOABOM_QUEUE_RUNTIME_SERVICE_ACCOUNT:-moabom-run@${PROJECT}.iam.gserviceaccount.com}"
ENV_FILE="${ROOT}/deploy/production.env.yaml"
TMP_ENV="$(mktemp)"
trap 'rm -f "${TMP_ENV}"' EXIT

EXISTING_QUEUE_URL="$(
  gcloud run services describe "${QUEUE_SERVICE}" \
    --region="${REGION}" \
    --project="${PROJECT}" \
    --format='value(status.url)' 2>/dev/null || true
)"

python3 - "${ENV_FILE}" "${TMP_ENV}" "${EXISTING_QUEUE_URL}" <<'PY'
import json
import sys

source, target, queue_url = sys.argv[1:4]
updates = {
    "MOABOM_RUNTIME_ROLE": "queue",
    "MOABOM_QUEUE_PLANE_MODE": "active",
    "MOABOM_QUEUE_TASK_TARGET_URL": (
        f"{queue_url}/api/modules/moabom-system/internal/queue/run" if queue_url else ""
    ),
    "MOABOM_QUEUE_TASK_AUDIENCE": queue_url,
}
seen = set()
out = []
for raw in open(source, encoding="utf-8"):
    key = raw.split(":", 1)[0].strip() if ":" in raw and not raw.lstrip().startswith("#") else ""
    if key in updates:
        out.append(f"{key}: {json.dumps(updates[key])}\n")
        seen.add(key)
    else:
        out.append(raw)
for key, value in updates.items():
    if key not in seen:
        out.append(f"{key}: {json.dumps(value)}\n")
open(target, "w", encoding="utf-8").writelines(out)
PY

gcloud services enable cloudtasks.googleapis.com \
  --project="${PROJECT}" \
  --quiet
if gcloud tasks queues describe "${TASKS_QUEUE}" \
  --location="${REGION}" \
  --project="${PROJECT}" >/dev/null 2>&1; then
  queue_action=update
else
  queue_action=create
fi
gcloud tasks queues "${queue_action}" "${TASKS_QUEUE}" \
  --location="${REGION}" \
  --project="${PROJECT}" \
  --max-dispatches-per-second=500 \
  --max-concurrent-dispatches=5000

gcloud tasks queues add-iam-policy-binding "${TASKS_QUEUE}" \
  --location="${REGION}" \
  --project="${PROJECT}" \
  --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
  --role="roles/cloudtasks.enqueuer" \
  --quiet >/dev/null

# OIDC task 생성자는 토큰 주체로 지정한 서비스 계정을 actAs 할 수 있어야 합니다.
gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SERVICE_ACCOUNT}" \
  --project="${PROJECT}" \
  --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
  --role="roles/iam.serviceAccountUser" \
  --quiet >/dev/null

mapfile -t CR_FLAGS < <(moabom_cloud_run_service_deploy_args)
gcloud run deploy "${QUEUE_SERVICE}" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --env-vars-file="${TMP_ENV}" \
  --set-cloudsql-instances="${SQL}" \
  --set-secrets="${SECRETS}" \
  --service-account="${RUNTIME_SERVICE_ACCOUNT}" \
  "${CR_FLAGS[@]}" \
  --no-allow-unauthenticated \
  --project="${PROJECT}"

QUEUE_URL="$(
  gcloud run services describe "${QUEUE_SERVICE}" \
    --region="${REGION}" \
    --project="${PROJECT}" \
    --format='value(status.url)'
)"
if [[ -z "${EXISTING_QUEUE_URL}" ]]; then
  # 최초 생성 때만 URL을 알 수 없어 두 번째 revision으로 self-target을 확정한다.
  gcloud run services update "${QUEUE_SERVICE}" \
    --region="${REGION}" \
    --project="${PROJECT}" \
    --update-env-vars="MOABOM_QUEUE_TASK_TARGET_URL=${QUEUE_URL}/api/modules/moabom-system/internal/queue/run,MOABOM_QUEUE_TASK_AUDIENCE=${QUEUE_URL}"
fi

echo "queue service ready: ${QUEUE_URL}"
echo "cloud tasks queue ready: ${TASKS_QUEUE} (500 req/s, concurrency 5000)"
echo "web shadow activation values:"
echo "  MOABOM_QUEUE_PLANE_MODE=shadow"
echo "  MOABOM_QUEUE_TASK_TARGET_URL=${QUEUE_URL}/api/modules/moabom-system/internal/queue/run"
echo "  MOABOM_QUEUE_TASK_AUDIENCE=${QUEUE_URL}"
