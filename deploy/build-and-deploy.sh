#!/usr/bin/env bash
# moabom Cloud Run — 빌드·배포 단일 진입점
#   --env-only     이미지 재빌드 없이 env 만 반영 (~1분)
#   --async        gcloud builds submit 비동기 (터미널 블로킹 최소)
#   --skip-check   검증 생략 (비권장, DEPLOY_SKIP_CHECK=1 필요)
#   --strict-smoke 선택 SaaS 스모크 파일 누락도 실패 처리
#   --migrate-modules=moabom-apps[,moabom-system] post-deploy migration 대상 allowlist
#
# 인프라 식별자 SSOT: deploy/lib/gcp-env.sh (project / region / service / sql / repo)
# 시크릿 SSOT: Secret Manager (deploy/secret-manager-bootstrap.sh 한 번 실행 필요)
#
# !!! 운영 이미지 빌드는 Cloud Build 에서만 실행됩니다 !!!
#   - 이 스크립트는 `gcloud builds submit` 으로 cloudbuild-v3.yaml 을 제출만 합니다.
#   - 로컬에서 `docker build -f deploy/Dockerfile ...` 또는 `docker push` 로
#     이미지를 직접 만들어 Cloud Run 에 배포하는 행위는 금지 — _bundled, node_modules,
#     sirsoft 활성 경로 등이 잘못 포함되어 활성 폴더 SSOT 원칙이 깨질 수 있습니다.
#   - 가드: deploy/Dockerfile 의 MOABOM_BUILD_ENV ARG + check-before-cloud-build.sh [v7-9]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/image-tag.sh
source "${ROOT}/deploy/lib/image-tag.sh"
# image-tag.sh 가 lib/gcp-env.sh 를 이미 source — moabom_gcp_* 사용 가능

PROJECT="$(moabom_gcp_project)"
REGION="$(moabom_gcp_region)"
SERVICE="$(moabom_gcp_cloud_run_service)"
SQL="$(moabom_gcp_cloudsql_instance)"
SECRETS="$(moabom_gcp_secret_mappings)"
ENV_FILE="${ROOT}/deploy/production.env.yaml"
CB="${ROOT}/deploy/cloudbuild-v3.yaml"

ASYNC=0
ENV_ONLY=0
SKIP_CHECK=0
SKIP_LAYOUT_SYNC=0
STRICT_SMOKE=0
POST_DEPLOY_MIGRATION_MODULES="${MOABOM_DEPLOY_MIGRATION_MODULES:-moabom-apps,moabom-system,moabom-presence,moabom-chat}"

for arg in "$@"; do
  case "$arg" in
    --async) ASYNC=1 ;;
    --env-only) ENV_ONLY=1 ;;
    --skip-layout-sync) SKIP_LAYOUT_SYNC=1 ;;
    --strict-smoke) STRICT_SMOKE=1 ;;
    --migrate-modules=*) POST_DEPLOY_MIGRATION_MODULES="${arg#*=}" ;;
    --skip-check)
      if [[ "${DEPLOY_SKIP_CHECK:-}" != "1" ]]; then
        echo "ERROR: --skip-check 는 DEPLOY_SKIP_CHECK=1 일 때만 허용"
        exit 1
      fi
      SKIP_CHECK=1
      ;;
    -h|--help)
      echo "Usage: $0 [--env-only] [--async] [--skip-check] [--skip-layout-sync] [--strict-smoke] [--migrate-modules=LIST|none]"
      echo "  태그: deploy/cloudbuild-v3.yaml 의 substitutions._IMAGE_TAG 만 수정"
      echo "  --skip-check: DEPLOY_SKIP_CHECK=1 $0 --skip-check"
      echo "  --skip-layout-sync: SaaS admin 레이아웃 DB sync 생략 (비권장)"
      echo "  --strict-smoke: 선택 SaaS 스모크 스크립트 누락도 실패 처리"
      echo "  --migrate-modules: post-deploy migration allowlist (기본: ${POST_DEPLOY_MIGRATION_MODULES}, env: MOABOM_DEPLOY_MIGRATION_MODULES)"
      exit 0
      ;;
    *) echo "Unknown: $arg"; exit 1 ;;
  esac
done

TAG="$(moabom_image_tag)"
IMAGE="$(moabom_container_image)"

gcloud config set project "${PROJECT}" >/dev/null

print_run_diagnostics() {
  echo "==> Cloud Run diagnostics (${SERVICE})"
  gcloud run services describe "${SERVICE}" \
    --region="${REGION}" \
    --project="${PROJECT}" \
    --format='yaml(status.url,status.latestReadyRevisionName,status.conditions,status.traffic)' || true
  echo "==> Recent Cloud Run logs"
  gcloud logging read \
    "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"${SERVICE}\"" \
    --project="${PROJECT}" \
    --limit=20 \
    --format='value(timestamp,severity,textPayload)' || true
}

wait_for_ready_revision() {
  local service_json ready condition
  service_json="$(gcloud run services describe "${SERVICE}" \
    --region="${REGION}" \
    --project="${PROJECT}" \
    --format=json 2>/dev/null || true)"
  ready="$(python3 -c 'import json,sys; d=json.load(sys.stdin); print((d.get("status") or {}).get("latestReadyRevisionName") or "")' <<<"${service_json}" 2>/dev/null || true)"
  condition="$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(next((c.get("status","") for c in (d.get("status") or {}).get("conditions", []) if c.get("type") == "Ready"), ""))' <<<"${service_json}" 2>/dev/null || true)"
  if [[ -z "${ready}" || "${condition}" != "True" ]]; then
    echo "ERROR: Cloud Run latestReadyRevisionName 없음 또는 Ready!=True"
    print_run_diagnostics
    exit 1
  fi
  echo "==> Cloud Run Ready revision: ${ready}"
}

run_smoke() {
  local url="$1"
  MOABOM_STRICT_SMOKE="${STRICT_SMOKE}" bash "${ROOT}/deploy/smoke-after-deploy.sh" "${url}"
}

post_deploy_migration_modules() {
  local raw="${POST_DEPLOY_MIGRATION_MODULES//[[:space:]]/}"
  [[ -n "${raw}" ]] || return 0
  [[ "${raw}" != "none" && "${raw}" != "skip" ]] || return 0

  local module_id
  IFS=',' read -ra modules <<< "${raw}"
  for module_id in "${modules[@]}"; do
    [[ -n "${module_id}" ]] || continue
    if [[ "${module_id}" != moabom-* ]]; then
      echo "ERROR: --migrate-modules 는 moabom-* 모듈만 허용: ${module_id}"
      exit 1
    fi
    if [[ "${module_id}" == *"*"* || "${module_id}" == *"/"* || "${module_id}" == *".."* ]]; then
      echo "ERROR: --migrate-modules 에 wildcard/path 금지: ${module_id}"
      exit 1
    fi
    if [[ ! -d "${ROOT}/app/modules/${module_id}/database/migrations" ]]; then
      echo "ERROR: migration 대상 모듈 없음: ${module_id}"
      exit 1
    fi
    printf '%s\n' "${module_id}"
  done
}

preflight_gcloud() {
  echo "==> GCP preflight"
  command -v gcloud >/dev/null || { echo "ERROR: gcloud CLI 없음"; exit 1; }
  local account
  account="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -1)"
  [[ -n "${account}" ]] || { echo "ERROR: active gcloud account 없음"; exit 1; }
  echo "    account=${account}"
  echo "    project=${PROJECT} region=${REGION} service=${SERVICE}"
  gcloud services list --enabled --project="${PROJECT}" --format='value(config.name)' \
    | grep -qx 'cloudbuild.googleapis.com' \
    || { echo "ERROR: Cloud Build API 비활성"; exit 1; }
  gcloud services list --enabled --project="${PROJECT}" --format='value(config.name)' \
    | grep -qx 'run.googleapis.com' \
    || { echo "ERROR: Cloud Run API 비활성"; exit 1; }
}

# Secret Manager 멱등 확인 — 누락이면 즉시 fail (운영 시크릿 미생성 상태로 배포 차단)
moabom_assert_secrets_ready() {
  if [[ "${DEPLOY_SKIP_SECRET_CHECK:-0}" == "1" ]]; then
    return 0
  fi
  local missing=0 secret_name
  for secret_name in \
    "${SECRET_DB_PASSWORD}" \
    "${SECRET_APP_KEY}" \
    "${SECRET_SOCIAL_NAVER}" \
    "${SECRET_SOCIAL_KAKAO}" \
    "${SECRET_SOCIAL_GOOGLE}"
  do
    if ! gcloud secrets describe "${secret_name}" --project="${PROJECT}" >/dev/null 2>&1; then
      echo "ERROR: Secret Manager '${secret_name}' 없음 — bash deploy/secret-manager-bootstrap.sh 한 번 실행 필요"
      missing=1
    fi
  done
  if [[ "${missing}" -ne 0 ]]; then
    echo "       Secret Manager 부트스트랩 후 재배포하세요. (스킵: DEPLOY_SKIP_SECRET_CHECK=1)"
    exit 1
  fi
}

if [[ "${ENV_ONLY}" -eq 1 ]]; then
  echo "==> env-only deploy (빌드 생략): ${IMAGE}"
  preflight_gcloud
  moabom_assert_secrets_ready
  gcloud run deploy "${SERVICE}" \
    --image="${IMAGE}" \
    --region="${REGION}" \
    --env-vars-file="${ENV_FILE}" \
    --add-cloudsql-instances="${SQL}" \
    --set-secrets="${SECRETS}" \
    --min-instances=1 \
    --cpu-throttling \
    --project="${PROJECT}"
  wait_for_ready_revision
  run_smoke ""
  exit 0
fi

moabom_assert_secrets_ready
preflight_gcloud

if [[ "${SKIP_CHECK}" -eq 0 ]]; then
  IMAGE_TAG="${TAG}" bash "${ROOT}/deploy/check-before-cloud-build.sh"
fi

echo "==> Cloud Build (${TAG})"
SUBMIT=(gcloud builds submit "${ROOT}" --config="${CB}" --project="${PROJECT}")
if [[ "${ASYNC}" -eq 1 ]]; then
  "${SUBMIT[@]}" --async
  echo "    비동기 제출됨. 완료 후:"
  echo "    gcloud builds list --ongoing --project=${PROJECT}"
  echo "    gcloud run deploy ${SERVICE} --image=${IMAGE} --region=${REGION} --env-vars-file=${ENV_FILE} --add-cloudsql-instances=${SQL} --set-secrets=${SECRETS} --min-instances=1 --cpu-throttling --project=${PROJECT}"
  echo "    smoke: MOABOM_STRICT_SMOKE=${STRICT_SMOKE} bash deploy/smoke-after-deploy.sh https://mek360.com"
  if grep -qE '^MOABOM_SAAS_ENABLED: "true"' "${ENV_FILE}" 2>/dev/null \
    && grep -qE '^MOABOM_SYNC_TEMPLATE_LAYOUTS: "true"' "${ENV_FILE}" 2>/dev/null; then
    echo "    layout DB sync (필수): IMAGE_TAG=${TAG} bash deploy/run-layout-sync-job.sh"
  fi
  exit 0
fi

BUILD_LOG="$(mktemp)"
trap 'rm -f "${BUILD_LOG}"' EXIT
"${SUBMIT[@]}" 2>&1 | tee "${BUILD_LOG}"
BUILD_ID="$(sed -nE 's#.*builds/([0-9a-f-]+).*#\1#p' "${BUILD_LOG}" | tail -1)"
if [[ -n "${BUILD_ID}" ]]; then
  echo "==> Cloud Build id: ${BUILD_ID}"
  gcloud builds describe "${BUILD_ID}" --project="${PROJECT}" --format='yaml(id,status,images,finishTime)' || true
fi

echo "==> Cloud Run deploy"
gcloud run deploy "${SERVICE}" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --env-vars-file="${ENV_FILE}" \
  --add-cloudsql-instances="${SQL}" \
  --set-secrets="${SECRETS}" \
  --min-instances=1 \
  --cpu-throttling \
  --project="${PROJECT}"

wait_for_ready_revision

URL="$(gcloud run services describe "${SERVICE}" --region="${REGION}" --project="${PROJECT}" --format='value(status.url)')"
echo "==> ${URL}"

if grep -qE '^RUN_MIGRATIONS: "false"' "${ENV_FILE}" 2>/dev/null; then
  echo "==> Post-deploy allowlist module migrations (RUN_MIGRATIONS=false safety)"
  echo "    modules=${POST_DEPLOY_MIGRATION_MODULES}"
  # shellcheck source=lib/cloud-run-artisan-job.sh
  source "${ROOT}/deploy/lib/cloud-run-artisan-job.sh"
  while IFS= read -r module_id; do
    moabom_run_artisan_job "moabom-${module_id}-migrate" 900s \
      migrate \
      --force \
      --no-interaction \
      --path="modules/${module_id}/database/migrations"
    if grep -qE '^MOABOM_SAAS_ENABLED: "true"' "${ENV_FILE}" 2>/dev/null; then
      moabom_run_artisan_job "moabom-${module_id}-tenant-migrate" 900s \
        moabom:saas:tenants:migrate \
        --force \
        --path="modules/${module_id}/database/migrations"
    fi
  done < <(post_deploy_migration_modules)
  if grep -qE '^MOABOM_SAAS_ENABLED: "true"' "${ENV_FILE}" 2>/dev/null; then
    echo "==> Post-deploy generated-apps platform schema (before smoke; Phase E 와 중복 없음)"
    moabom_run_artisan_job moabom-apps-platform-migrate 900s \
      moabom:apps:platform-migrate --force --no-interaction
    moabom_run_artisan_job moabom-presence-platform-migrate 900s \
      moabom:presence:platform-migrate --force --no-interaction
  fi
fi

if grep -qE '^MOABOM_SAAS_ENABLED: "true"' "${ENV_FILE}" 2>/dev/null; then
  run_smoke "https://mek360.com"
else
  run_smoke "${URL}"
fi

# SaaS: 이미지 filesystem layout → tenant DB (수동 Job 우회 제거 — 배포 파이프라인에 포함)
if [[ "${SKIP_LAYOUT_SYNC}" -eq 0 ]] \
  && grep -qE '^MOABOM_SAAS_ENABLED: "true"' "${ENV_FILE}" 2>/dev/null \
  && grep -qE '^MOABOM_SYNC_TEMPLATE_LAYOUTS: "true"' "${ENV_FILE}" 2>/dev/null; then
  echo "==> Post-deploy layout DB sync (moabom-admin_basic → platform + tenants)"
  IMAGE_TAG="${TAG}" bash "${ROOT}/deploy/run-layout-sync-job.sh"
  echo "==> Post-deploy Phase E (platform-migrate + permissions + legacy appearance)"
  IMAGE_TAG="${TAG}" bash "${ROOT}/deploy/run-saas-phase-e-post-deploy.sh"
fi

echo "==> deploy complete: ${IMAGE}"
