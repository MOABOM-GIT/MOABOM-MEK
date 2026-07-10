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

# RF-24: image·cmd·timeout 이 같으면 jobs update 생략 (직렬 배포 시간 절약).
# 강제: MOABOM_CRJ_FORCE_JOB_UPDATE=1
moabom_cloud_run_job_spec_matches() {
  local job_name="$1"
  local image="$2"
  local shell_cmd="$3"
  local task_timeout="$4"
  local cur_image cur_args cur_timeout desired_args

  cur_image="$(gcloud run jobs describe "${job_name}" \
    --region="${MOABOM_CRJ_REGION}" --project="${MOABOM_CRJ_PROJECT}" \
    --format='value(spec.template.spec.containers[0].image)' 2>/dev/null || true)"
  [[ "${cur_image}" == "${image}" ]] || return 1

  # gcloud 는 args 를 세미콜론 구분으로 출력 (bash;-lc;cmd…)
  cur_args="$(gcloud run jobs describe "${job_name}" \
    --region="${MOABOM_CRJ_REGION}" --project="${MOABOM_CRJ_PROJECT}" \
    --format='value(spec.template.spec.containers[0].args)' 2>/dev/null || true)"
  desired_args="-lc;${shell_cmd}"
  # 일부 포맷은 선행 'bash' 없이 args 만, 또는 전체 CSV
  if [[ "${cur_args}" != "${desired_args}" && "${cur_args}" != "bash;${desired_args}" && "${cur_args}" != *";${shell_cmd}" ]]; then
    # args 문자열에 shell_cmd 가 포함되면 동일로 간주 (포맷 편차)
    [[ "${cur_args}" == *"${shell_cmd}"* ]] || return 1
  fi

  cur_timeout="$(gcloud run jobs describe "${job_name}" \
    --region="${MOABOM_CRJ_REGION}" --project="${MOABOM_CRJ_PROJECT}" \
    --format='value(spec.template.spec.timeoutSeconds)' 2>/dev/null || true)"
  # task_timeout 은 900s / 1800s 형태 — 초 단위와 비교
  local want_sec="${task_timeout%s}"
  if [[ -n "${cur_timeout}" && "${cur_timeout}" != "${want_sec}" ]]; then
    return 1
  fi

  return 0
}

# @param job_name @param task_timeout (e.g. 900s) @param artisan_arg ...
moabom_run_artisan_job() {
  local job_name="$1"
  local task_timeout="$2"
  shift 2
  local -a artisan_tail=("$@")
  local image shell_cmd arg service_account boot_sleep
  local -a service_account_args=()
  local job_exists=0 needs_update=1

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

  if gcloud run jobs describe "${job_name}" \
    --region="${MOABOM_CRJ_REGION}" --project="${MOABOM_CRJ_PROJECT}" &>/dev/null; then
    job_exists=1
  fi

  if [[ "${job_exists}" -eq 1 ]]; then
    if [[ "${MOABOM_CRJ_FORCE_JOB_UPDATE:-0}" == "1" ]]; then
      needs_update=1
    elif moabom_cloud_run_job_spec_matches "${job_name}" "${image}" "${shell_cmd}" "${task_timeout}"; then
      needs_update=0
      echo "   skip jobs update (image/cmd/timeout unchanged — RF-24)" >&2
    fi
  fi

  if [[ "${job_exists}" -eq 0 ]]; then
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
  elif [[ "${needs_update}" -eq 1 ]]; then
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
    echo "RF-24: 이미지 재빌드·_IMAGE_TAG 증가 금지. layout 만 재실행:" >&2
    echo "  IMAGE_TAG=$(moabom_image_tag) bash deploy/run-post-deploy-layout-pipeline.sh" >&2
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
