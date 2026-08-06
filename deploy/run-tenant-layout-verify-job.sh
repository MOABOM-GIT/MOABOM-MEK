#!/usr/bin/env bash
# platform + active tenant의 DB layout/UI 바인딩과 언어팩 정합성을 검증합니다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE="${1:-moabom-admin_basic}"
TIMEOUT="${MOABOM_LAYOUT_SYNC_TIMEOUT:-1800s}"

# shellcheck source=lib/cloud-run-artisan-job.sh
source "${ROOT}/deploy/lib/cloud-run-artisan-job.sh"

echo "[tenant-layout-verify] tenant-reconcile verify-only template=${TEMPLATE}"
moabom_run_artisan_job moabom-tenant-reconcile-verify "${TIMEOUT}" \
  moabom:saas:tenant-reconcile \
  --template="${TEMPLATE}" \
  --skip-template-layouts \
  --skip-module-layouts \
  --skip-menus \
  --skip-language-packs \
  --no-interaction

echo "[tenant-layout-verify] OK — admin_settings layout / language-packs binding"
