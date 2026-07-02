#!/usr/bin/env bash
# RF-13b: platform module layouts — filesystem 정합·override purge (매 배포, hash 게이트 무관)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TIMEOUT="${MOABOM_PLATFORM_MODULE_LAYOUT_RECONCILE_TIMEOUT:-1800s}"

# shellcheck source=lib/cloud-run-artisan-job.sh
source "${ROOT}/deploy/lib/cloud-run-artisan-job.sh"

echo "[run-platform-module-layout-reconcile-job] image=$(moabom_image_tag)"
moabom_run_artisan_job moabom-platform-module-layout-reconcile "${TIMEOUT}" \
  moabom:saas:reconcile-platform-module-layouts \
  --no-interaction
echo "[run-platform-module-layout-reconcile-job] done — 로그에서 'platform module layout reconcile 완료' 확인"
