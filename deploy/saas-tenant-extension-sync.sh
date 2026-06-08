#!/usr/bin/env bash
# hospital-default.json modules[]·plugins[] → 모든 active tenant DB
# MOABOM_SYNC_TENANT_EXTENSIONS_ACTIVATE=true (기본) → 패키지 항목 inactive 를 active 로
# MOABOM_SYNC_TENANT_EXTENSIONS_ACTIVATE=false → 누락 row만 INSERT, on/off 유지
set -euo pipefail

PACKAGE="${1:-hospital-default}"
ACTIVATE="${MOABOM_SYNC_TENANT_EXTENSIONS_ACTIVATE:-true}"

cd /var/www/html 2>/dev/null || cd "$(dirname "$0")/../app"

args=(
  --apply
  --package="${PACKAGE}"
  --skip-menus
  --skip-menu-rows
  --skip-templates
  --no-interaction
)

if [[ "${ACTIVATE}" == "true" ]]; then
  echo "[saas-tenant-extension-sync] moabom:saas:tenant-repair * package=${PACKAGE} activate"
else
  echo "[saas-tenant-extension-sync] moabom:saas:tenant-repair * package=${PACKAGE} insert-only"
  args+=(--insert-only)
fi

php artisan moabom:saas:tenant-repair '*' "${args[@]}"
echo "[saas-tenant-extension-sync] done"
