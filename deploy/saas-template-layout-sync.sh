#!/usr/bin/env bash
# moabom-admin_basic layouts/*.json → platform + active tenant DB (컨테이너 내부용)
# Cloud Run Job 은 deploy/run-layout-sync-job.sh 사용 (RF-12: '*' 금지)
set -euo pipefail

TEMPLATE="${1:-moabom-admin_basic}"

cd /var/www/html 2>/dev/null || cd "$(dirname "$0")/../app"

echo "[saas-template-layout-sync] moabom:saas:sync-template-layouts (all tenants) template=${TEMPLATE}"
php artisan moabom:saas:sync-template-layouts \
  --template="${TEMPLATE}" \
  --no-interaction
php artisan template:cache-clear --no-interaction
echo "[saas-template-layout-sync] done"
