#!/usr/bin/env bash
# Phase E — 배포 직후 SaaS hospitals purge/usage 운영 반영
#
# 1) platform-migrate (moabom_saas_tenant_operations)
# 2) admin credentials normalize (platform + active tenants)
# 3) legacy appearance re-apply (선택)
#
# apps platform-migrate · module-sync-declarations 는 build-and-deploy 선행 단계·
# run-layout-sync-job.sh 에서 이미 실행 — 여기서 중복하지 않음.
#
# 생성앱 legacy→platform 데이터 이관 Artisan 은 1회성 수동만 (배포 post-deploy 금지).
# SaaS 쓰기 SSOT는 platform — tenant legacy 에 신규 생성 경로 없음, 배포마다 돌리면 삭제 앱 복원 위험.
#
# layout sync는 deploy/run-layout-sync-job.sh 가 선행되어야 함.
#
# Usage:
#   IMAGE_TAG=v161 bash deploy/run-saas-phase-e-post-deploy.sh
#   SAAS_LEGACY_APPEARANCE_SLUG=autocloud864134 bash deploy/run-saas-phase-e-post-deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TIMEOUT="${MOABOM_SAAS_PHASE_E_TIMEOUT:-900s}"
LEGACY_SLUG="${SAAS_LEGACY_APPEARANCE_SLUG:-}"

# shellcheck source=lib/cloud-run-artisan-job.sh
source "${ROOT}/deploy/lib/cloud-run-artisan-job.sh"

echo "[run-saas-phase-e-post-deploy] image=$(moabom_image_tag)"

echo "[1/2] platform-migrate (operations audit table)"
moabom_run_artisan_job moabom-saas-platform-migrate "${TIMEOUT}" \
  moabom:saas:platform-migrate --force --no-interaction

echo "[2/2] normalize admin credentials (platform + active tenants)"
moabom_run_artisan_job moabom-saas-normalize-admin-credentials "${TIMEOUT}" \
  moabom:saas:normalize-admin-credentials all --no-interaction

if [[ -n "${LEGACY_SLUG}" ]]; then
  echo "[optional] legacy appearance re-apply slug=${LEGACY_SLUG}"
  moabom_run_artisan_job "moabom-saas-reapply-appearance-${LEGACY_SLUG}" "${TIMEOUT}" \
    moabom:saas:tenant-reapply-appearance-defaults "${LEGACY_SLUG}" --no-interaction
else
  echo "[optional] skip legacy appearance (SAAS_LEGACY_APPEARANCE_SLUG empty)"
fi

echo "[run-saas-phase-e-post-deploy] done"
echo "  smoke: AUTH_TOKEN=... bash deploy/saas-platform-hospitals-smoke.sh"
echo "  phase-e: AUTH_TOKEN=... bash deploy/saas-hospitals-phase-e-smoke.sh"
