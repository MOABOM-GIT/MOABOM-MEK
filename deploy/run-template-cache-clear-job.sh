#!/usr/bin/env bash
# Post-deploy — ext.cache_version bump + 템플릿 routes/lang Redis 무효화 (Cloud Run Job)
# layout sync Job 이 스킵된 이미지 배포에서도 클라이언트 ?v= 갱신을 보장한다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# shellcheck source=lib/cloud-run-artisan-job.sh
source "${ROOT}/deploy/lib/cloud-run-artisan-job.sh"

echo "[run-template-cache-clear-job] image=$(moabom_image_tag)"
moabom_run_artisan_job moabom-template-cache-clear 120s template:cache-clear --no-interaction
echo "[run-template-cache-clear-job] done"
