#!/usr/bin/env bash
# Cloud Run Job — tenant DB admin Sanctum token (E2E·smoke SSOT)
# Usage: SLUG=freshent bash deploy/saas-tenant-admin-token-job.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/cloud-run-artisan-job.sh
source "${ROOT}/deploy/lib/cloud-run-artisan-job.sh"

SLUG="${SLUG:?SLUG required}"
EMAIL="${ADMIN_EMAIL:-admin@mek360.com}"
JOB="mobaom-saas-tenant-admin-token"

exec_name="$(moabom_run_artisan_job "${JOB}" "120s" \
  "moabom:saas:tenant-admin-token" "${SLUG}" "--email=${EMAIL}")"

token="$(moabom_job_stdout_line "${JOB}" "${exec_name}" '^[0-9]+\|[A-Za-z0-9_-]+$' | tr -d '\r\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

if [[ -z "${token}" ]]; then
  echo "FAIL: token not found in job logs (execution=${exec_name})" >&2
  exit 1
fi

echo "${token}"
