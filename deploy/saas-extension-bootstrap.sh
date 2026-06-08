#!/usr/bin/env bash
# hospital-default.json modules[]·plugins[] → DB install+active (Cloud Run / artisan job)
# moabom-system 분리 후 filesystem-only 확장이 404·관리자 미설치로 보이는 구조적 gap 을 메운다.
set -euo pipefail

PACKAGE="${1:-hospital-default}"
DECL="${MOABOM_SYNC_PACKAGE_DECLARATIONS:-false}"

cd /var/www/html 2>/dev/null || cd "$(dirname "$0")/../app"

args=(--package="${PACKAGE}" --no-interaction)
if [[ "${DECL}" == "true" ]]; then
  args+=(--declarations)
fi

echo "[saas-extension-bootstrap] moabom:saas:sync-package-extensions ${PACKAGE}"
php artisan moabom:saas:sync-package-extensions "${args[@]}"
echo "[saas-extension-bootstrap] done"
