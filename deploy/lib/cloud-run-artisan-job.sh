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
MOABOM_CRJ_SERVICE_ACCOUNT="${MOABOM_CRJ_SERVICE_ACCOUNT:-}"

moabom_cloud_run_job_service_account() {
  if [[ -n "${MOABOM_CRJ_SERVICE_ACCOUNT}" ]]; then
    echo "${MOABOM_CRJ_SERVICE_ACCOUNT}"
    return 0
  fi

  local service
  service="$(moabom_gcp_cloud_run_service)"
  gcloud run services describe "${service}" \
    --region="${MOABOM_CRJ_REGION}" \
    --project="${MOABOM_CRJ_PROJECT}" \
    --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true
}

# @param job_name @param task_timeout (e.g. 900s) @param artisan_arg ...
moabom_run_artisan_job() {
  local job_name="$1"
  local task_timeout="$2"
  shift 2
  local -a artisan_tail=("$@")
  local image shell_cmd arg service_account boot_sleep
  local -a service_account_args=()

  for arg in "${artisan_tail[@]}"; do
    if [[ "${arg}" == "*" ]]; then
      echo "ERROR: Cloud Run Job args must not include literal '*'." >&2
      echo "       moabom:saas:sync-template-layouts — slug 인자 생략(전체) 또는 freshent 등 slug 지정." >&2
      echo "       See deploy/DEPLOY-RECURRING-FAILURES.md RF-12" >&2
      exit 1
    fi
  done

  image="$(moabom_container_image)"
  service_account="$(moabom_cloud_run_job_service_account)"
  if [[ -n "${service_account}" ]]; then
    service_account_args=(--service-account="${service_account}")
  fi
  boot_sleep="${MOABOM_CRJ_BOOT_SLEEP:-10}"
  shell_cmd="sleep ${boot_sleep} && php artisan"
  for arg in "${artisan_tail[@]}"; do
    shell_cmd+=" $(printf '%q' "$arg")"
  done

  # INSTALLER_COMPLETED=true 이면 ModuleRouteServiceProvider 가 부팅 즉시 DB 조회 →
  # Cloud SQL 소켓 마운트 전 artisan migrate 가 실패할 수 있음 (v270+ post-deploy).
  local job_env_file
  job_env_file="$(mktemp)"
  sed 's/^INSTALLER_COMPLETED: "true"/INSTALLER_COMPLETED: "false"/' \
    "${MOABOM_CRJ_ENV_FILE}" > "${job_env_file}"
  # RETURN 시 local 변수가 이미 해제되므로 경로를 trap 문자열에 고정한다.
  trap "rm -f '${job_env_file}'" RETURN

  echo "== cloud-run-artisan-job ${job_name} image=${image} ==" >&2
  echo "   cmd: bash -lc ${shell_cmd}" >&2

  if ! gcloud run jobs describe "${job_name}" \
    --region="${MOABOM_CRJ_REGION}" --project="${MOABOM_CRJ_PROJECT}" &>/dev/null; then
    gcloud run jobs create "${job_name}" \
      --region="${MOABOM_CRJ_REGION}" \
      --project="${MOABOM_CRJ_PROJECT}" \
      --image="${image}" \
      "${service_account_args[@]}" \
      --set-cloudsql-instances="${MOABOM_CRJ_SQL}" \
      --env-vars-file="${job_env_file}" \
      --set-secrets="${MOABOM_CRJ_SECRETS}" \
      --command=bash \
      --args=-lc,"${shell_cmd}" \
      --tasks=1 \
      --max-retries=0 \
      --task-timeout="${task_timeout}"
  else
    gcloud run jobs update "${job_name}" \
      --region="${MOABOM_CRJ_REGION}" \
      --project="${MOABOM_CRJ_PROJECT}" \
      --image="${image}" \
      "${service_account_args[@]}" \
      --set-cloudsql-instances="${MOABOM_CRJ_SQL}" \
      --env-vars-file="${job_env_file}" \
      --set-secrets="${MOABOM_CRJ_SECRETS}" \
      --command=bash \
      --args=-lc,"${shell_cmd}" \
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
