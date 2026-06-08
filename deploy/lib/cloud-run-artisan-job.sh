#!/usr/bin/env bash
# Cloud Run Job — php artisan … 공용 (provision · token · migrate · layout-sync)
#
# 인프라 식별자 SSOT: deploy/lib/gcp-env.sh
# 시크릿: deploy/lib/gcp-env.sh#moabom_gcp_secret_mappings (Secret Manager)
# shellcheck disable=SC2034
set -euo pipefail

_MOABOM_CRJ_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=image-tag.sh
source "${_MOABOM_CRJ_ROOT}/deploy/lib/image-tag.sh"
# image-tag.sh 가 gcp-env.sh 를 이미 source 함 (project / region / sql 함수 사용 가능)

MOABOM_CRJ_REGION="$(moabom_gcp_region)"
MOABOM_CRJ_PROJECT="$(moabom_gcp_project)"
MOABOM_CRJ_SQL="$(moabom_gcp_cloudsql_instance)"
MOABOM_CRJ_ENV_FILE="${MOABOM_CRJ_ENV_FILE:-${_MOABOM_CRJ_ROOT}/deploy/production.env.yaml}"
MOABOM_CRJ_SECRETS="$(moabom_gcp_secret_mappings)"

# @param job_name @param task_timeout (e.g. 900s) @param artisan_arg ...
moabom_run_artisan_job() {
  local job_name="$1"
  local task_timeout="$2"
  shift 2
  local -a artisan_tail=("$@")
  local image args_csv arg

  for arg in "${artisan_tail[@]}"; do
    if [[ "${arg}" == "*" ]]; then
      echo "ERROR: Cloud Run Job args must not include literal '*'." >&2
      echo "       moabom:saas:sync-template-layouts — slug 인자 생략(전체) 또는 freshent 등 slug 지정." >&2
      echo "       See deploy/DEPLOY-RECURRING-FAILURES.md RF-12" >&2
      exit 1
    fi
  done

  image="$(moabom_container_image)"
  args_csv="artisan"
  for arg in "${artisan_tail[@]}"; do
    args_csv+=",${arg}"
  done

  echo "== cloud-run-artisan-job ${job_name} image=${image} ==" >&2
  echo "   args: php ${args_csv//,/ }" >&2

  if ! gcloud run jobs describe "${job_name}" \
    --region="${MOABOM_CRJ_REGION}" --project="${MOABOM_CRJ_PROJECT}" &>/dev/null; then
    gcloud run jobs create "${job_name}" \
      --region="${MOABOM_CRJ_REGION}" \
      --project="${MOABOM_CRJ_PROJECT}" \
      --image="${image}" \
      --set-cloudsql-instances="${MOABOM_CRJ_SQL}" \
      --env-vars-file="${MOABOM_CRJ_ENV_FILE}" \
      --set-secrets="${MOABOM_CRJ_SECRETS}" \
      --command=php \
      --args="${args_csv}" \
      --tasks=1 \
      --max-retries=0 \
      --task-timeout="${task_timeout}"
  else
    gcloud run jobs update "${job_name}" \
      --region="${MOABOM_CRJ_REGION}" \
      --project="${MOABOM_CRJ_PROJECT}" \
      --image="${image}" \
      --env-vars-file="${MOABOM_CRJ_ENV_FILE}" \
      --set-secrets="${MOABOM_CRJ_SECRETS}" \
      --command=php \
      --args="${args_csv}" \
      --task-timeout="${task_timeout}"
  fi

  local exec_name exit_code
  exec_name="$(gcloud run jobs execute "${job_name}" \
    --region="${MOABOM_CRJ_REGION}" \
    --project="${MOABOM_CRJ_PROJECT}" \
    --format='value(metadata.name)' \
    --quiet \
    --wait)"

  exit_code="$(gcloud run jobs executions describe "${exec_name}" \
    --region="${MOABOM_CRJ_REGION}" \
    --project="${MOABOM_CRJ_PROJECT}" \
    --format='value(status.succeededCount)' 2>/dev/null || echo "0")"
  if [[ "${exit_code}" != "1" ]]; then
    echo "FAIL: job execution ${exec_name} (succeededCount=${exit_code})" >&2
    gcloud logging read \
      "resource.type=\"cloud_run_job\"
       resource.labels.job_name=\"${job_name}\"
       labels.\"run.googleapis.com/execution_name\"=\"${exec_name}\"" \
      --project="${MOABOM_CRJ_PROJECT}" \
      --limit=10 \
      --format='value(textPayload)' 2>/dev/null | tail -5 >&2 || true
    exit 1
  fi

  echo "${exec_name}"
}

# stdout 마지막 Sanctum token (id|secret) 또는 지정 패턴
moabom_job_stdout_line() {
  local job_name="$1"
  local exec_name="$2"
  local pattern="${3:-.*}"

  sleep 2
  gcloud logging read \
    "resource.type=\"cloud_run_job\"
     resource.labels.job_name=\"${job_name}\"
     labels.\"run.googleapis.com/execution_name\"=\"${exec_name}\"" \
    --project="${MOABOM_CRJ_PROJECT}" \
    --limit=80 \
    --format='value(textPayload)' \
    2>/dev/null | grep -E "${pattern}" | tail -1 || true
}
