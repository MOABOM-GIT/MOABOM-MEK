#!/usr/bin/env bash
# hospital-default.json modules[]·plugins[] → 모든 active tenant DB (가용성)
# 기본: insert-only — 기존 테넌트 on/off 유지, 누락 row 만 INSERT(inactive)
# MOABOM_SYNC_TENANT_EXTENSIONS_ACTIVATE=true 는 신규 업체 provision 경로용이며
# 이 스크립트(기존 테넌트 sync)에서는 사용하지 않는다 (RF-32).
set -euo pipefail

PACKAGE="${1:-hospital-default}"

cd /var/www/html 2>/dev/null || cd "$(dirname "$0")/../app"

echo "[saas-tenant-extension-sync] moabom:saas:tenant-repair (all active) package=${PACKAGE} insert-only (availability)"
php artisan moabom:saas:tenant-repair \
  --apply \
  --package="${PACKAGE}" \
  --insert-only \
  --skip-menus \
  --skip-menu-rows \
  --skip-templates \
  --skip-legal-pages \
  --no-interaction
echo "[saas-tenant-extension-sync] done"
