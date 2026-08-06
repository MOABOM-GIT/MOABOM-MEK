#!/usr/bin/env bash
# 활성 modules/* (module.php + composer.json) 가 bootstrap/cache/autoload-extensions.php 에 등록됐는지 검사.
# DB 없이 tarball/로컬 제출 전 실행. 실패 시: ./scripts/g7 php artisan extension:update-autoload
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${ROOT}/app"
AUTOLOAD="${APP}/bootstrap/cache/autoload-extensions.php"
MODULES="${APP}/modules"
PLUGINS="${APP}/plugins"

FAIL=0
fail() { echo "ERROR: $*"; FAIL=1; }
ok()   { echo "    OK: $*"; }

[[ -f "${AUTOLOAD}" ]] || { fail "autoload-extensions.php 없음 — extension:update-autoload 실행"; exit 1; }

MISSING=()
PLUGIN_MISSING=()
CHECKED=0
CHECKED_PLUGINS=0

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

for dir in "${PLUGINS}"/*; do
  [[ -d "${dir}" ]] || continue
  name="$(basename "${dir}")"
  [[ "${name}" == _* ]] && continue
  [[ -f "${dir}/plugin.php" ]] || continue
  [[ -f "${dir}/composer.json" ]] || continue

  CHECKED_PLUGINS=$((CHECKED_PLUGINS + 1))
  if ! grep -q "\"plugins/${name}/" "${AUTOLOAD}" 2>/dev/null; then
    PLUGIN_MISSING+=("${name}")
  fi
done

if [[ "${#MISSING[@]}" -gt 0 ]]; then
  fail "autoload-extensions.php 에 PSR-4 누락: ${MISSING[*]}"
  echo "       ./scripts/g7 php artisan extension:update-autoload --no-interaction"
  echo "       ./scripts/g7 php artisan optimize:clear"
  FAIL=1
else
  ok "extension autoload source (${CHECKED} modules with composer.json)"
fi

if [[ "${#PLUGIN_MISSING[@]}" -gt 0 ]]; then
  GENERATOR="${ROOT}/scripts/generate-extension-autoload.php"
  DOCKERFILE="${ROOT}/deploy/Dockerfile"
  [[ -f "${GENERATOR}" ]] \
    && grep -q 'generate-extension-autoload.php /app' "${DOCKERFILE}" \
    || fail "플러그인 오토로드 누락(${PLUGIN_MISSING[*]}) + Cloud Build filesystem generator 미연결"
  ok "plugin autoload (${CHECKED_PLUGINS}; Cloud Build filesystem generator가 ${#PLUGIN_MISSING[@]}개 보완)"
else
  ok "plugin autoload (${CHECKED_PLUGINS} plugins with composer.json)"
fi

exit "${FAIL}"
