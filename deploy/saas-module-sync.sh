#!/usr/bin/env bash
# moabom-system: 권한·레이아웃·라우트 DB 동기화 (Cloud Run — _bundled 없음)
set -euo pipefail

MODULE="${1:-moabom-system}"

ADMIN_TEMPLATE="${ADMIN_TEMPLATE:-moabom-admin_basic}"

if [[ -d "templates/${ADMIN_TEMPLATE}" ]]; then
  echo "[saas-module-sync] template:install ${ADMIN_TEMPLATE} --force (skip if Cloud Run: no _pending)"
  php artisan template:install "${ADMIN_TEMPLATE}" --force || true
fi

echo "[saas-module-sync] template:activate ${ADMIN_TEMPLATE} (ignore if already active)"
php artisan template:activate "${ADMIN_TEMPLATE}" --force 2>/dev/null \
  || php artisan template:activate "${ADMIN_TEMPLATE}" 2>/dev/null \
  || echo "[saas-module-sync] template already active — skip"

echo "[saas-module-sync] moabom:module-sync-declarations ${MODULE}"
php artisan "moabom:module-sync-declarations" "${MODULE}"

if [ "${MOABOM_SAAS_ENABLED:-false}" = "true" ]; then
  echo "[saas-module-sync] moabom:saas:sync-module-layouts (platform + active tenants)"
  php artisan moabom:saas:sync-module-layouts --no-interaction
else
  echo "[saas-module-sync] module:refresh-layout ${MODULE}"
  php artisan "module:refresh-layout" "${MODULE}"
fi

echo "[saas-module-sync] template:cache-clear"
php artisan template:cache-clear

echo "[saas-module-sync] done"
