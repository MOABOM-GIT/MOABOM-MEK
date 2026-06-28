#!/bin/sh
# Cloud Run — nginx/php-fpm 기동 후 백그라운드 SaaS sync (콜드스타트 502 완화)
# 운영(production.env.yaml): MOABOM_ENTRYPOINT_DEFERRED_SYNC=false → 배포 Job SSOT만 사용
set -eu

cd /var/www/html

if [ "${MOABOM_ENTRYPOINT_DEFERRED_SYNC:-true}" != "true" ]; then
  echo "[deferred-sync] MOABOM_ENTRYPOINT_DEFERRED_SYNC=false — skip (deploy jobs + entrypoint fast path)"
  exit 0
fi

echo "[deferred-sync] waiting for php-fpm/nginx settle..."
sleep 2

# hospital-default.json modules[]·plugins[] ↔ DB install+active (분리 모듈 404·관리자 미설치 방지)
if [ "${MOABOM_SYNC_PACKAGE_EXTENSIONS:-true}" = "true" ]; then
  echo "[deferred-sync] Syncing package extensions (hospital-default catalog)..."
  php artisan moabom:saas:sync-package-extensions --no-interaction || true
fi

# active tenant DB — hospital-default modules/plugins 동기화
if [ "${MOABOM_SAAS_ENABLED:-false}" = "true" ] && [ "${MOABOM_SYNC_TENANT_EXTENSIONS:-true}" = "true" ]; then
  if [ "${MOABOM_SYNC_TENANT_EXTENSIONS_ACTIVATE:-true}" = "true" ]; then
    echo "[deferred-sync] Syncing tenant package extensions (activate package on/off)..."
    php artisan moabom:saas:tenant-repair '*' \
      --apply \
      --package=hospital-default \
      --skip-menus \
      --skip-menu-rows \
      --skip-templates \
      --no-interaction || true
  else
    echo "[deferred-sync] Syncing tenant package extensions (insert-only, preserve on/off)..."
    php artisan moabom:saas:tenant-repair '*' \
      --apply \
      --package=hospital-default \
      --insert-only \
      --skip-menus \
      --skip-menu-rows \
      --skip-templates \
      --no-interaction || true
  fi
fi

moabom_sync_template_layouts() {
  local template_id
  for template_id in moabom-admin_basic moabom-basic; do
    if [ "${MOABOM_SAAS_ENABLED:-false}" = "true" ]; then
      php artisan moabom:saas:sync-template-layouts \
        --template="${template_id}" \
        --no-interaction || return 1
    else
      php artisan template:refresh-layout "${template_id}" --no-interaction || return 1
    fi
  done
  if [ "${MOABOM_SAAS_ENABLED:-false}" != "true" ]; then
    php artisan template:cache-clear --no-interaction
  fi
}

if [ "${MOABOM_SYNC_TEMPLATE_LAYOUTS:-true}" = "true" ]; then
  echo "[deferred-sync] Syncing template layouts..."
  _layout_sync_ok=0
  _layout_sync_attempt=1
  while [ "${_layout_sync_attempt}" -le 3 ]; do
    if moabom_sync_template_layouts; then
      _layout_sync_ok=1
      echo "[deferred-sync] Template layout sync OK (attempt ${_layout_sync_attempt})"
      break
    fi
    echo "[deferred-sync] WARN: template layout sync failed (attempt ${_layout_sync_attempt}/3)"
    _layout_sync_attempt=$((_layout_sync_attempt + 1))
    sleep 3
  done
  if [ "${_layout_sync_ok}" -eq 0 ]; then
    echo "[deferred-sync] ERROR: template layout sync failed after 3 attempts"
  fi
fi

if [ "${MOABOM_SAAS_ENABLED:-false}" = "true" ] \
  && [ "${MOABOM_SYNC_MODULE_LAYOUTS:-true}" = "true" ]; then
  echo "[deferred-sync] Syncing module layouts..."
  _module_layout_sync_ok=0
  _module_layout_sync_attempt=1
  while [ "${_module_layout_sync_attempt}" -le 3 ]; do
    if php artisan moabom:saas:sync-module-layouts --no-interaction; then
      _module_layout_sync_ok=1
      echo "[deferred-sync] Module layout sync OK (attempt ${_module_layout_sync_attempt})"
      break
    fi
    echo "[deferred-sync] WARN: module layout sync failed (attempt ${_module_layout_sync_attempt}/3)"
    _module_layout_sync_attempt=$((_module_layout_sync_attempt + 1))
    sleep 3
  done
  if [ "${_module_layout_sync_ok}" -eq 0 ]; then
    echo "[deferred-sync] ERROR: module layout sync failed after 3 attempts"
  fi
fi

if [ "${MOABOM_SAAS_ENABLED:-false}" = "true" ] \
  && [ "${MOABOM_SYNC_TENANT_ADMIN_MENUS:-true}" = "true" ]; then
  echo "[deferred-sync] Syncing module declarations (hospital-default SSOT)..."
  php artisan moabom:saas:sync-module-declarations --no-interaction || true
  echo "[deferred-sync] Syncing tenant admin menus..."
  php artisan moabom:saas:sync-tenant-admin-menus --no-interaction || true
fi

if [ "${MOABOM_SAAS_ENABLED:-false}" = "true" ] \
  && [ "${MOABOM_VERIFY_TENANT_RECONCILE:-true}" = "true" ]; then
  echo "[deferred-sync] Verifying tenant reconcile..."
  if php artisan moabom:saas:tenant-reconcile \
    --template=moabom-admin_basic \
    --skip-template-layouts \
    --skip-module-layouts \
    --skip-menus \
    --skip-language-packs \
    --no-interaction; then
    echo "[deferred-sync] Tenant reconcile verify OK"
  else
    echo "[deferred-sync] ERROR: tenant reconcile verify FAILED"
  fi
fi

echo "[deferred-sync] done"
