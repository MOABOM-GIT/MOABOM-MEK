#!/usr/bin/env bash
# moabom Cloud Run — 빌드·배포 단일 진입점
#   --env-only     이미지 재빌드 없이 env 만 반영 (~1분)
#   --async        gcloud builds submit 비동기 (터미널 블로킹 최소)
#   --skip-check   검증 생략 (비권장, DEPLOY_SKIP_CHECK=1 필요)
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

for arg in "$@"; do
  case "$arg" in
    --async) ASYNC=1 ;;
    --env-only) ENV_ONLY=1 ;;
    --skip-layout-sync) SKIP_LAYOUT_SYNC=1 ;;
    --skip-check)
      if [[ "${DEPLOY_SKIP_CHECK:-}" != "1" ]]; then
        echo "ERROR: --skip-check 는 DEPLOY_SKIP_CHECK=1 일 때만 허용"
        exit 1
      fi
      SKIP_CHECK=1
      ;;
    -h|--help)
      echo "Usage: $0 [--env-only] [--async] [--skip-check] [--skip-layout-sync]"
      echo "  태그: deploy/cloudbuild-v3.yaml 의 substitutions._IMAGE_TAG 만 수정"
      echo "  --skip-check: DEPLOY_SKIP_CHECK=1 $0 --skip-check"
      echo "  --skip-layout-sync: SaaS admin 레이아웃 DB sync 생략 (비권장)"
      exit 0
      ;;
    *) echo "Unknown: $arg"; exit 1 ;;
  esac
done

TAG="$(moabom_image_tag)"
IMAGE="$(moabom_container_image)"

gcloud config set project "${PROJECT}" >/dev/null

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
  moabom_assert_secrets_ready
  gcloud run deploy "${SERVICE}" \
    --image="${IMAGE}" \
    --region="${REGION}" \
    --env-vars-file="${ENV_FILE}" \
    --add-cloudsql-instances="${SQL}" \
    --set-secrets="${SECRETS}" \
    --min-instances=1 \
    --no-cpu-throttling \
    --project="${PROJECT}"
  bash "${ROOT}/deploy/smoke-after-deploy.sh" || exit 1
  exit 0
fi

if [[ "${SKIP_CHECK}" -eq 0 ]]; then
  IMAGE_TAG="${TAG}" bash "${ROOT}/deploy/check-before-cloud-build.sh"
fi

moabom_assert_secrets_ready

echo "==> Cloud Build (${TAG})"
SUBMIT=(gcloud builds submit --config="${CB}" --project="${PROJECT}")
if [[ "${ASYNC}" -eq 1 ]]; then
  "${SUBMIT[@]}" --async
  echo "    비동기 제출됨. 완료 후:"
  echo "    gcloud builds list --ongoing --project=${PROJECT}"
  echo "    gcloud run deploy ${SERVICE} --image=${IMAGE} --region=${REGION} --env-vars-file=${ENV_FILE} --add-cloudsql-instances=${SQL} --set-secrets=${SECRETS} --min-instances=1 --no-cpu-throttling --project=${PROJECT}"
  echo "    smoke: bash deploy/smoke-after-deploy.sh https://mek360.com"
  if grep -qE '^MOABOM_SAAS_ENABLED: "true"' "${ENV_FILE}" 2>/dev/null \
    && grep -qE '^MOABOM_SYNC_TEMPLATE_LAYOUTS: "true"' "${ENV_FILE}" 2>/dev/null; then
    echo "    layout DB sync (필수): IMAGE_TAG=${TAG} bash deploy/run-layout-sync-job.sh"
  fi
  exit 0
fi

"${SUBMIT[@]}"

echo "==> Cloud Run deploy"
gcloud run deploy "${SERVICE}" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --env-vars-file="${ENV_FILE}" \
  --add-cloudsql-instances="${SQL}" \
  --set-secrets="${SECRETS}" \
  --min-instances=1 \
  --no-cpu-throttling \
  --project="${PROJECT}"

URL="$(gcloud run services describe "${SERVICE}" --region="${REGION}" --project="${PROJECT}" --format='value(status.url)')"
echo "==> ${URL}"
if grep -qE '^MOABOM_SAAS_ENABLED: "true"' "${ENV_FILE}" 2>/dev/null; then
  bash "${ROOT}/deploy/smoke-after-deploy.sh" "https://mek360.com"
else
  bash "${ROOT}/deploy/smoke-after-deploy.sh" "${URL}"
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
