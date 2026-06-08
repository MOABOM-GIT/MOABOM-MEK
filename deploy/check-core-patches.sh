#!/usr/bin/env bash
# Moabom 최소 코어 패치 정합성 — core:update / 업스트림 전 회귀 게이트
# Usage: bash deploy/check-core-patches.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${ROOT}/app"
PATCH="${ROOT}/deploy/core-patches/moabom-core.patch"
APPLY="${ROOT}/deploy/core-patches/apply-core-patches.sh"
FAIL=0

fail() { echo "FAIL: $*"; FAIL=1; }
ok()   { echo "OK:   $*"; }

echo "== check-core-patches =="

[[ -f "${PATCH}" ]] || fail "moabom-core.patch 없음"
[[ -x "${APPLY}" ]] || fail "apply-core-patches.sh 없음 또는 실행 불가"
[[ -f "${APP}/config/moabom-saas.php" ]] || fail "config/moabom-saas.php 없음"

if grep -q 'spatie/laravel-google-cloud-storage' "${APP}/composer.json" 2>/dev/null; then
  ok "composer.json: spatie/laravel-google-cloud-storage"
else
  fail "composer.json: GCS Spatie 패키지 누락 (패치 밖 필수)"
fi

if grep -q 'GoogleCloudStorageServiceProvider' "${APP}/bootstrap/providers.php" 2>/dev/null; then
  ok "bootstrap/providers.php: GCS Provider"
else
  fail "bootstrap/providers.php: Spatie GCS Provider 누락"
fi

if grep -q 'trustProxies' "${APP}/bootstrap/app.php" 2>/dev/null; then
  ok "bootstrap/app.php: trustProxies"
else
  fail "bootstrap/app.php: Cloud Run trustProxies 누락"
fi

PATCH_FILES="$(grep -c '^diff --git' "${PATCH}" || true)"
[[ "${PATCH_FILES}" -ge 15 && "${PATCH_FILES}" -le 25 ]] \
  || fail "패치 파일 수 비정상: ${PATCH_FILES} (기대 18±)"

cd "${APP}"
if git apply --check --reverse "${PATCH}" >/dev/null 2>&1; then
  ok "워킹 트리: 패치 적용 상태 (reverse-check)"
elif git apply --check "${PATCH}" >/dev/null 2>&1; then
  ok "워킹 트리: pristine — 패치 적용 가능"
else
  fail "패치 적용 불가 — core:update 충돌 또는 수동 drift. regenerate.sh 검토"
fi

echo ""
if [[ "${FAIL}" -ne 0 ]]; then
  echo "== FAILED: 코어 패치 게이트 =="
  exit 1
fi

echo "== PASSED: 코어 패치 게이트 OK (${PATCH_FILES} files) =="
