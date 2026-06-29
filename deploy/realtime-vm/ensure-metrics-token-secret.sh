#!/usr/bin/env bash
# Secret Manager: moabom-realtime-vm-metrics-token (멱등) + Cloud Run secretAccessor
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=../lib/gcp-env.sh
source "${ROOT}/deploy/lib/gcp-env.sh"

PROJECT="$(moabom_gcp_project)"
REGION="$(moabom_gcp_region)"
SERVICE="$(moabom_gcp_cloud_run_service)"
SECRET="${SECRET_REALTIME_VM_METRICS_TOKEN}"

if gcloud secrets describe "${SECRET}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "OK: secret ${SECRET} exists"
else
  token="$(openssl rand -base64 32)"
  echo "Creating secret ${SECRET}..."
  echo -n "${token}" | gcloud secrets create "${SECRET}" \
    --replication-policy=automatic \
    --data-file=- \
    --project="${PROJECT}"
  echo "Created ${SECRET} — VM: sudo bash ${ROOT}/deploy/realtime-vm/install-on-vm.sh (metrics sync)"
fi

SA_EMAIL="$(gcloud run services describe "${SERVICE}" \
  --region="${REGION}" --project="${PROJECT}" \
  --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
if [[ -z "${SA_EMAIL}" ]]; then
  PROJECT_NUMBER="$(gcloud projects describe "${PROJECT}" --format='value(projectNumber)')"
  SA_EMAIL="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
fi

gcloud secrets add-iam-policy-binding "${SECRET}" \
  --project="${PROJECT}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None \
  --quiet >/dev/null 2>&1 || true

echo "OK: ${SECRET} accessor → ${SA_EMAIL}"
