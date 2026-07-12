#!/bin/sh
# Cloud Run fast boot — HTTP 리스너(supervisord)를 먼저 띄우고 무거운 sync 는 deferred Job
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

  for migration_dir in modules/*/database/migrations; do
    if [ ! -d "${migration_dir}" ]; then
      continue
    fi
    echo "[entrypoint] Running module migrations: ${migration_dir}"
    php artisan migrate --force --no-interaction --path="${migration_dir}"
  done

  if [ "${MOABOM_SAAS_ENABLED:-false}" = "true" ]; then
    echo "[entrypoint] Running SaaS platform registry migrations..."
    php artisan moabom:saas:platform-migrate --force --no-interaction || true
    echo "[entrypoint] Running generated-apps platform schema migrations..."
    php artisan moabom:apps:platform-migrate --force --no-interaction || true
    echo "[entrypoint] Running presence platform schema migrations..."
    php artisan moabom:presence:platform-migrate --force --no-interaction || true
  fi
fi

# SaaS sync·layout·reconcile — deploy/cloudrun-deferred-sync.sh (supervisord 백그라운드)

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
php artisan route:clear --no-interaction || true
php artisan view:cache --no-interaction || true
php artisan event:cache --no-interaction 2>/dev/null || true

echo "[entrypoint] Ensuring platform SNS master settings..."
php artisan moabom:social-auth:seed-platform-master --no-interaction || true

echo "[entrypoint] Warming nginx static extension bundles (public/ext-static)..."
php artisan ext-bundles:warm-static --no-interaction || true

echo "[entrypoint] Warming nginx static template lang JSON (public/ext-static/lang)..."
php artisan moabom:warm-template-lang-static --no-interaction || true

mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs
# Cloud Run CACHE_STORE=file — 인스턴스 로컬 캐시가 layout sync Job 과 분리되어 구형 layout 이 남을 수 있음
rm -rf storage/framework/cache/data/* 2>/dev/null || true
chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwx storage bootstrap/cache

if [ "${RUN_MIGRATIONS:-true}" = "false" ]; then
  echo "[entrypoint] RUN_MIGRATIONS=false — skipping migrate on next boots"
fi

echo "[entrypoint] starting supervisord (nginx + php-fpm before deferred sync)"
exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
