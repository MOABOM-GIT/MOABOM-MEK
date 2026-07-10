#!/usr/bin/env bash
# RF-24: 이미지 재빌드 없이 layout 정합만 재실행 (증상 패치 후 전체 배포 금지)
#
# 사용:
#   IMAGE_TAG=v459 bash deploy/run-post-deploy-layout-pipeline.sh
#   MOABOM_FORCE_LAYOUT_SYNC=1 IMAGE_TAG=v459 bash deploy/run-post-deploy-layout-pipeline.sh
#
# 전제: Cloud Run 서비스가 이미 해당 IMAGE_TAG 를 서빙 중이어야 함.
# SoftDeletes/reconcile 버그 수정 후 → 태그 증가·Cloud Build 없이 이 스크립트만.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/image-tag.sh
source "${ROOT}/deploy/lib/image-tag.sh"
# shellcheck source=lib/layout-sync-hash.sh
source "${ROOT}/deploy/lib/layout-sync-hash.sh"

TAG="$(moabom_image_tag)"
ENV_FILE="${ROOT}/deploy/production.env.yaml"

if ! grep -qE '^MOABOM_SAAS_ENABLED: "true"' "${ENV_FILE}" 2>/dev/null; then
  echo "ERROR: MOABOM_SAAS_ENABLED 가 true 가 아님 — layout pipeline 생략" >&2
  exit 1
fi
if ! grep -qE '^MOABOM_SYNC_TEMPLATE_LAYOUTS: "true"' "${ENV_FILE}" 2>/dev/null; then
  echo "ERROR: MOABOM_SYNC_TEMPLATE_LAYOUTS 가 true 가 아님" >&2
  exit 1
fi

echo "==> RF-24 layout-only pipeline (no Cloud Build) image=$(moabom_container_image)"
echo "    이미지 재빌드·_IMAGE_TAG 증가 금지. 실패 시에도 태그 올리지 말고 이 스크립트만 재실행."

echo "==> platform module layout reconcile"
IMAGE_TAG="${TAG}" bash "${ROOT}/deploy/run-platform-module-layout-reconcile-job.sh"
moabom_layout_sync_record_platform_layout_versions

if moabom_layout_sync_needed; then
  echo "==> layout DB sync (template + module + declarations)"
  IMAGE_TAG="${TAG}" bash "${ROOT}/deploy/run-layout-sync-job.sh"
  moabom_layout_sync_record_success
else
  echo "==> layout DB sync skipped (manifest unchanged)"
  echo "==> template:cache-clear"
  IMAGE_TAG="${TAG}" bash "${ROOT}/deploy/run-template-cache-clear-job.sh"
fi

echo "==> serving cache bust"
bash "${ROOT}/deploy/run-serving-cache-bust.sh"

echo "==> RF-24 layout-only pipeline complete: $(moabom_container_image)"
