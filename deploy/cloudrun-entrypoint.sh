#!/bin/sh
# Cloud Run fast boot — 이미지에 고정된 산출물을 사용하고 HTTP 리스너를 즉시 기동한다.
set -eu

cd /var/www/html

# Cloud Run: .env 파일 없이 env 변수만 쓸 때 Laravel·라우트 프로바이더 호환용 최소 .env
if [ ! -f .env ] && [ -n "${APP_KEY:-}" ]; then
  {
    echo "APP_KEY=${APP_KEY}"
    echo "INSTALLER_COMPLETED=${INSTALLER_COMPLETED:-true}"
  } > .env
fi

# 정상 경로는 Dockerfile 에서 생성한 autoload를 그대로 사용한다.
# FORCE=true는 이전 revision으로 즉시 롤백하기 위한 비상 호환 경로다.
if [ "${FORCE_EXTENSION_AUTOLOAD:-false}" = "true" ] \
  || [ ! -s bootstrap/cache/autoload-extensions.php ]; then
  echo "[entrypoint] Regenerating missing/forced extension autoload..."
  php artisan extension:update-autoload --no-interaction
else
  echo "[entrypoint] Using image-baked extension autoload"
fi

mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs
chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwx storage bootstrap/cache

supervisor_config="/etc/supervisor/supervisord.conf"
if [ "${MOABOM_RUNTIME_ROLE:-web}" = "queue" ]; then
  supervisor_config="/etc/supervisor/supervisord-queue.conf"
elif [ "${MOABOM_QUEUE_PLANE_MODE:-legacy}" = "active" ]; then
  supervisor_config="/etc/supervisor/supervisord-web.conf"
fi

echo "[entrypoint] starting supervisord role=${MOABOM_RUNTIME_ROLE:-web} queue=${MOABOM_QUEUE_PLANE_MODE:-legacy}"
exec /usr/bin/supervisord -n -c "${supervisor_config}"
