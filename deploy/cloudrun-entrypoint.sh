#!/bin/sh
set -eu

cd /var/www/html

# Cloud Run: .env 파일 없이 env 변수만 쓸 때 Laravel·라우트 프로바이더 호환용 최소 .env
if [ ! -f .env ] && [ -n "${APP_KEY:-}" ]; then
  {
    echo "APP_KEY=${APP_KEY}"
    echo "INSTALLER_COMPLETED=${INSTALLER_COMPLETED:-true}"
  } > .env
fi

# Cloud Run: 환경 변수만 사용 (이미지에 .env 없음)
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] Running database migrations..."
  php artisan migrate --force --no-interaction

  # 코어 migrate 는 모듈 마이그레이션 경로를 항상 포함하지 않으므로,
  # 활성 modules/*/database/migrations 를 순회해 누락을 방지한다.
  # platform/ 서브디렉터리는 moabom_platform 연결 전용 → 별도 단계에서 실행.
  for migration_dir in modules/*/database/migrations; do
    if [ ! -d "${migration_dir}" ]; then
      continue
    fi
    echo "[entrypoint] Running module migrations: ${migration_dir}"
    php artisan migrate --force --no-interaction --path="${migration_dir}"
  done

  # SaaS 플랫폼 레지스트리(moabom_saas_tenants) 마이그레이션 — moabom_platform 연결
  # 활성화는 MOABOM_SAAS_ENABLED=true 일 때만, 컬럼 추가/idempotent 안전망.
  if [ "${MOABOM_SAAS_ENABLED:-false}" = "true" ]; then
    echo "[entrypoint] Running SaaS platform registry migrations..."
    php artisan moabom:saas:platform-migrate --force --no-interaction || true
  fi
fi

# hospital-default.json modules[]·plugins[] ↔ DB install+active (분리 모듈 404·관리자 미설치 방지)
if [ "${MOABOM_SYNC_PACKAGE_EXTENSIONS:-true}" = "true" ]; then
  echo "[entrypoint] Syncing package extensions (hospital-default catalog)..."
  php artisan moabom:saas:sync-package-extensions --no-interaction || true
fi

# active tenant DB — hospital-default modules/plugins 동기화
# MOABOM_SYNC_TENANT_EXTENSIONS_ACTIVATE=true (기본): 패키지 항목 inactive → active
# MOABOM_SYNC_TENANT_EXTENSIONS_ACTIVATE=false: 누락 row만 INSERT, 테넌트 on/off 유지
if [ "${MOABOM_SAAS_ENABLED:-false}" = "true" ] && [ "${MOABOM_SYNC_TENANT_EXTENSIONS:-true}" = "true" ]; then
  if [ "${MOABOM_SYNC_TENANT_EXTENSIONS_ACTIVATE:-true}" = "true" ]; then
    echo "[entrypoint] Syncing tenant package extensions (activate package on/off)..."
    php artisan moabom:saas:tenant-repair '*' \
      --apply \
      --package=hospital-default \
      --skip-menus \
      --skip-menu-rows \
      --skip-templates \
      --no-interaction || true
  else
    echo "[entrypoint] Syncing tenant package extensions (insert-only, preserve on/off)..."
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

# filesystem layouts/*.json → DB (부팅 시 idempotent — 배포 직후 1차 sync 는 build-and-deploy.sh)
moabom_sync_template_layouts() {
  if [ "${MOABOM_SAAS_ENABLED:-false}" = "true" ]; then
    php artisan moabom:saas:sync-template-layouts \
      --template=moabom-admin_basic \
      --no-interaction
  else
    php artisan template:refresh-layout moabom-admin_basic --no-interaction
    php artisan template:cache-clear --no-interaction
  fi
}

if [ "${MOABOM_SYNC_TEMPLATE_LAYOUTS:-true}" = "true" ]; then
  echo "[entrypoint] Syncing template layouts (filesystem → DB, moabom-admin_basic)..."
  _layout_sync_ok=0
  _layout_sync_attempt=1
  while [ "${_layout_sync_attempt}" -le 3 ]; do
    if moabom_sync_template_layouts; then
      _layout_sync_ok=1
      echo "[entrypoint] Template layout sync OK (attempt ${_layout_sync_attempt})"
      break
    fi
    echo "[entrypoint] WARN: template layout sync failed (attempt ${_layout_sync_attempt}/3)"
    _layout_sync_attempt=$((_layout_sync_attempt + 1))
    sleep 3
  done
  if [ "${_layout_sync_ok}" -eq 0 ]; then
    echo "[entrypoint] ERROR: template layout sync failed after 3 attempts — check Cloud SQL / moabom:saas:sync-template-layouts logs"
  fi
else
  echo "[entrypoint] MOABOM_SYNC_TEMPLATE_LAYOUTS=false — layout DB sync skipped"
fi

# moabom-system module layouts (admin_mypage_settings 등) — platform + active tenants (RF-14b)
if [ "${MOABOM_SAAS_ENABLED:-false}" = "true" ] \
  && [ "${MOABOM_SYNC_MODULE_LAYOUTS:-true}" = "true" ]; then
  echo "[entrypoint] Syncing module layouts (moabom-system → platform + tenants)..."
  _module_layout_sync_ok=0
  _module_layout_sync_attempt=1
  while [ "${_module_layout_sync_attempt}" -le 3 ]; do
    if php artisan moabom:saas:sync-module-layouts --no-interaction; then
      _module_layout_sync_ok=1
      echo "[entrypoint] Module layout sync OK (attempt ${_module_layout_sync_attempt})"
      break
    fi
    echo "[entrypoint] WARN: module layout sync failed (attempt ${_module_layout_sync_attempt}/3)"
    _module_layout_sync_attempt=$((_module_layout_sync_attempt + 1))
    sleep 3
  done
  if [ "${_module_layout_sync_ok}" -eq 0 ]; then
    echo "[entrypoint] ERROR: module layout sync failed after 3 attempts — check moabom:saas:sync-module-layouts logs"
  fi
else
  echo "[entrypoint] MOABOM_SYNC_MODULE_LAYOUTS=false or SaaS off — module layout DB sync skipped"
fi

# Tenant admin 메뉴 SSOT — platform SaaS 메뉴 오염·레거시 hospital-settings 제거 (idempotent)
if [ "${MOABOM_SAAS_ENABLED:-false}" = "true" ] \
  && [ "${MOABOM_SYNC_TENANT_ADMIN_MENUS:-true}" = "true" ]; then
  echo "[entrypoint] Syncing tenant admin menus (moabom-system Host-aware + hygiene)..."
  php artisan moabom:module-sync-declarations moabom-system --no-interaction || true
  php artisan moabom:saas:sync-tenant-admin-menus --no-interaction || true
else
  echo "[entrypoint] MOABOM_SYNC_TENANT_ADMIN_MENUS=false — tenant admin menu sync skipped"
fi

# ── B안: 테넌트 런타임 정합성 검증 패스 (single reconciler) ──
# 위 동기화 단계들이 각자 `|| true` 로 실패가 묻혀 "한 테넌트만 조용히 깨짐"이 반복됐다(RF-18b/19b).
# 동기화는 위에서 끝났으므로 여기서는 검증 전용(--skip-*)으로 platform + 모든 active tenant 의
# 실제 사용자 표면(환경설정>언어팩 목록·admin_settings)을 점검해 깨진 테넌트를 ERROR 로 드러낸다.
# 수동 수렴이 필요하면 `php artisan moabom:saas:tenant-reconcile` (skip 없이) 한 번이면 전부 복구된다.
if [ "${MOABOM_SAAS_ENABLED:-false}" = "true" ] \
  && [ "${MOABOM_VERIFY_TENANT_RECONCILE:-true}" = "true" ]; then
  echo "[entrypoint] Verifying tenant reconcile (language-packs·admin_settings 정합성)..."
  if php artisan moabom:saas:tenant-reconcile \
    --template=moabom-admin_basic \
    --skip-template-layouts \
    --skip-module-layouts \
    --skip-menus \
    --skip-language-packs \
    --no-interaction; then
    echo "[entrypoint] Tenant reconcile verify OK"
  else
    echo "[entrypoint] ERROR: tenant reconcile verify FAILED — 깨진 테넌트 존재 (RF-18b/RF-19b). 수동 복구: php artisan moabom:saas:tenant-reconcile"
  fi
else
  echo "[entrypoint] MOABOM_VERIFY_TENANT_RECONCILE=false or SaaS off — reconcile verify skipped"
fi

# 설치 완료 환경: DB에 등록된 모듈·플러그인 기준으로 매 부팅 갱신 (moabom-credit 등 500 방지)
if [ "${FORCE_EXTENSION_AUTOLOAD:-false}" = "true" ] \
  || [ "${INSTALLER_COMPLETED:-false}" = "true" ] \
  || [ ! -s bootstrap/cache/autoload-extensions.php ]; then
  echo "[entrypoint] Generating extension autoload (modules/plugins PSR-4)..."
  php artisan extension:update-autoload --no-interaction || true
else
  echo "[entrypoint] Reusing bootstrap/cache/autoload-extensions.php"
fi

echo "[entrypoint] Optimizing Laravel (config/view cache; route:cache skipped for dynamic modules)..."
php artisan config:cache --no-interaction || true
# 모듈·플러그인 라우트는 DB 활성 상태에 따라 동적 등록 → route:cache 사용 금지
php artisan route:clear --no-interaction || true
php artisan view:cache --no-interaction || true
php artisan event:cache --no-interaction 2>/dev/null || true

# 플랫폼 master SNS credential·broker row (idempotent — env SOCIAL_AUTH_MASTER_*)
echo "[entrypoint] Ensuring platform SNS master settings..."
php artisan moabom:social-auth:seed-platform-master --no-interaction || true

# config:cache / view:cache 는 root 로 실행 → file 캐시·storage 가 root 소유가 되면
# php-fpm(www-data) 이 MoabomPublicApiCache 등에 쓸 수 없어 전 API 500 (Permission denied)
mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs
chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwx storage bootstrap/cache

# 마이그레이션 1회 성공 후 재배포 시 중복 실행 방지 (수동: RUN_MIGRATIONS=true)
if [ "${RUN_MIGRATIONS:-true}" = "false" ]; then
  echo "[entrypoint] RUN_MIGRATIONS=false — skipping migrate on next boots"
fi

exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
