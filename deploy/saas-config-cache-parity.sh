#!/usr/bin/env bash
# config:cache 후 tenant settings 격리 — 로컬 docker = Cloud Run entrypoint parity
# Usage: bash deploy/saas-config-cache-parity.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

if ! docker compose ps --status running app 2>/dev/null | grep -q app; then
  echo "ERROR: docker compose app 컨테이너가 실행 중이 아닙니다."
  exit 1
fi

echo "==> saas-config-cache-parity (docker app)"

docker compose exec -T -e MOABOM_SAAS_ENABLED=true -e MOABOM_SAAS_BASE_DOMAIN=mek360.com \
  -e MOABOM_SAAS_PLATFORM_HOSTS=mek360.com,www.mek360.com app bash -lc '
  set -euo pipefail
  php artisan config:cache --no-interaction
  enabled="$(php artisan tinker --execute="echo config('\''moabom-system.saas.enabled'\'') ? '\''1'\'' : '\''0'\'';" 2>/dev/null | tail -1)"
  [[ "${enabled}" == "1" ]] || { echo "FAIL: config:cache 후 saas.enabled != 1 (got ${enabled})"; exit 1; }
  php vendor/bin/phpunit \
    modules/moabom-system/tests/Unit/Repositories/MoabomJsonConfigRepositoryTest.php \
    modules/moabom-system/tests/Unit/Experience/TenantExperienceDefaultsReaderIsolationTest.php \
    modules/moabom-system/tests/Unit/Saas/SaasCachedConfigBridgeTest.php \
    modules/moabom-system/tests/Unit/Providers/MoabomServiceContainerBindingsTest.php
  php artisan config:clear --no-interaction
'

echo "==> saas-config-cache-parity OK"
