#!/usr/bin/env bash
# SSOT — deploy/cloudbuild-v3.yaml substitutions._IMAGE_TAG
#
# Usage:
#   source deploy/lib/image-tag.sh
#   tag="$(moabom_image_tag)"        # v205
#   image="$(moabom_container_image)" # asia-…/smartmek/moabom-dock/mobaom-container:v205
#
# 인프라 식별자(project/region/repo/service)는 deploy/lib/gcp-env.sh SSOT 만 사용.
set -euo pipefail

_MOABOM_DEPLOY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
_MOABOM_CLOUDBUILD="${_MOABOM_DEPLOY_ROOT}/cloudbuild-v3.yaml"

# shellcheck source=gcp-env.sh
source "${_MOABOM_DEPLOY_ROOT}/lib/gcp-env.sh"

moabom_image_tag() {
  if [[ -n "${IMAGE_TAG:-}" ]]; then
    echo "${IMAGE_TAG}"
    return 0
  fi
  grep -E '^  _IMAGE_TAG:' "${_MOABOM_CLOUDBUILD}" | awk '{print $2}'
}

moabom_container_image() {
  local service="$(moabom_gcp_cloud_run_service)"
  echo "$(moabom_gcp_image_repo)/${service}:$(moabom_image_tag)"
}
