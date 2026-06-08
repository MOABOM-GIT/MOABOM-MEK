#!/usr/bin/env bash
# 활성 modules/* (module.php + composer.json) 가 bootstrap/cache/autoload-extensions.php 에 등록됐는지 검사.
# DB 없이 tarball/로컬 제출 전 실행. 실패 시: ./scripts/g7 php artisan extension:update-autoload
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${ROOT}/app"
AUTOLOAD="${APP}/bootstrap/cache/autoload-extensions.php"
MODULES="${APP}/modules"

FAIL=0
fail() { echo "ERROR: $*"; FAIL=1; }
ok()   { echo "    OK: $*"; }

[[ -f "${AUTOLOAD}" ]] || { fail "autoload-extensions.php 없음 — extension:update-autoload 실행"; exit 1; }

MISSING=()
CHECKED=0

for dir in "${MODULES}"/*; do
  [[ -d "${dir}" ]] || continue
  name="$(basename "${dir}")"
  [[ "${name}" == _* ]] && continue
  [[ -f "${dir}/module.php" ]] || continue
  [[ -f "${dir}/composer.json" ]] || continue

  CHECKED=$((CHECKED + 1))
  if ! grep -q "\"modules/${name}/" "${AUTOLOAD}" 2>/dev/null; then
    MISSING+=("${name}")
  fi
done

if [[ "${#MISSING[@]}" -gt 0 ]]; then
  fail "autoload-extensions.php 에 PSR-4 누락: ${MISSING[*]}"
  echo "       ./scripts/g7 php artisan extension:update-autoload --no-interaction"
  echo "       ./scripts/g7 php artisan optimize:clear"
  FAIL=1
else
  ok "extension autoload (${CHECKED} modules with composer.json)"
fi

exit "${FAIL}"
