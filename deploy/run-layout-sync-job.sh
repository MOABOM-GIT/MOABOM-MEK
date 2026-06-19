#!/usr/bin/env bash
# RF-13: moabom-admin_basic filesystem → platform + tenant DB (Cloud Run Job)
# DEPLOY-RECURRING-FAILURES.md — admin layout JSON 변경 배포 직후 1회 실행 권장
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE="${1:-moabom-admin_basic}"
TIMEOUT="${MOABOM_LAYOUT_SYNC_TIMEOUT:-1800s}"

# shellcheck source=lib/cloud-run-artisan-job.sh
source "${ROOT}/deploy/lib/cloud-run-artisan-job.sh"

echo "[run-layout-sync-job] template=${TEMPLATE} image=$(moabom_image_tag)"
echo "[run-layout-sync-job] slug 생략 = platform + active tenants (절대 '*' 전달 금지)"

sync_template_layouts() {
  local template_id="$1"
  local job_suffix
  job_suffix="$(printf '%s' "${template_id}" | tr '_' '-')"
  echo "[run-layout-sync-job] sync-template-layouts --template=${template_id}"
  moabom_run_artisan_job "moabom-layout-sync-${job_suffix}" "${TIMEOUT}" \
    moabom:saas:sync-template-layouts \
    --template="${template_id}" \
    --no-interaction
}

sync_template_layouts "${TEMPLATE}"
# 사용자 템플릿(moabom-basic) — board/* 등 홈 셸 게시판 윈도우 레이아웃 DB 반영
if [[ "${TEMPLATE}" != "moabom-basic" ]]; then
  sync_template_layouts moabom-basic
fi

# moabom-system 모듈 레이아웃(admin_saas_hospitals 등)은 template 이 아닌 module_layouts — 별도 refresh 필수
echo "[run-layout-sync-job] moabom:saas:sync-module-layouts (platform + tenants — admin_mypage_settings SSOT)"
moabom_run_artisan_job moabom-module-layout-sync "${TIMEOUT}" \
  moabom:saas:sync-module-layouts --no-interaction

moabom_run_artisan_job moabom-module-sync-decl "${TIMEOUT}" \
  moabom:module-sync-declarations moabom-system --no-interaction

echo "[run-layout-sync-job] tenant admin menu hygiene (all active tenants)"
moabom_run_artisan_job moabom-tenant-admin-menu-sync "${TIMEOUT}" \
  moabom:saas:sync-tenant-admin-menus --no-interaction

echo "[run-layout-sync-job] tenant language_packs mirror (platform → tenants)"
moabom_run_artisan_job moabom-tenant-language-pack-sync "${TIMEOUT}" \
  moabom:saas:sync-tenant-language-packs --no-interaction

moabom_run_artisan_job moabom-template-cache-clear 120s template:cache-clear --no-interaction

# B안 — 위 동기화가 끝난 뒤, platform + 모든 active tenant 의 실제 사용자 표면을 검증한다.
# (환경설정>언어팩 목록 비어있음·admin_settings 구형 레이아웃 잔존 → Job 실패로 드러냄)
# 동기화 단계는 위에서 이미 수행 → 여기서는 검증 전용(--skip-*)으로 비용 없이 확인만 한다.
echo "[run-layout-sync-job] tenant-reconcile (verify-only — 언어팩 목록·admin_settings 정합성)"
moabom_run_artisan_job moabom-tenant-reconcile-verify "${TIMEOUT}" \
  moabom:saas:tenant-reconcile \
  --template="${TEMPLATE}" \
  --skip-template-layouts \
  --skip-module-layouts \
  --skip-menus \
  --skip-language-packs \
  --no-interaction

echo "[run-layout-sync-job] done — 로그에서 'admin_settings layout OK' / 'language-packs total=' 확인"
