#!/usr/bin/env bash
# layout sync 직후 Cloud Run 서빙 인스턴스 file 캐시 분리 문제 완화 — revision 재시작(캐시 bust env)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/gcp-env.sh
source "${ROOT}/deploy/lib/gcp-env.sh"

REGION="$(moabom_gcp_region)"
PROJECT="$(moabom_gcp_project)"
SERVICE="$(moabom_gcp_cloud_run_service)"
BUST="$(date +%s)"

echo "[run-serving-cache-bust] service=${SERVICE} MOABOM_LAYOUT_CACHE_BUST=${BUST}"

gcloud run services update "${SERVICE}" \
  --region="${REGION}" \
  --project="${PROJECT}" \
  --update-env-vars="MOABOM_LAYOUT_CACHE_BUST=${BUST}" \
  --quiet

echo "[run-serving-cache-bust] done — 새 revision 으로 인스턴스 교체 (로컬 file cache 초기화)"
