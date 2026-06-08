#!/usr/bin/env bash
# Moabom 최소 코어 패치 정합성 — core:update / 업스트림 전 회귀 게이트
# Usage: bash deploy/check-core-patches.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${ROOT}/app"
PATCH="${ROOT}/deploy/core-patches/moabom-core.patch"
APPLY="${ROOT}/deploy/core-patches/apply-core-patches.sh"
# shellcheck source=lib/g7-worktree.sh
source "${ROOT}/deploy/lib/g7-worktree.sh"
FAIL=0

fail() { echo "FAIL: $*"; FAIL=1; }
ok()   { echo "OK:   $*"; }

check_patch_capsule_symbols() {
  grep -q 'config/moabom-saas.php' "${PATCH}" \
    || fail "moabom-core.patch 에 config/moabom-saas.php 누락"
  grep -q 'loadDeferredExtensionAssets' "${PATCH}" \
    || fail "moabom-core.patch 에 loadDeferredExtensionAssets 누락"
  grep -q 'loadDeferredExtensionAssets' "${APP}/resources/js/core/template-engine/ActionDispatcher.ts" \
    || fail "ActionDispatcher.ts 에 loadDeferredExtensionAssets 미적용"
  grep -q 'GoogleCloudStorageServiceProvider' "${PATCH}" \
    || fail "moabom-core.patch 에 GCS Provider 누락"
  grep -q 'applyStorageDriverConfig' "${PATCH}" \
    || fail "moabom-core.patch 에 storage_driver named disk 적용 로직 누락"
  grep -q 'applyStorageDriverConfig' "${APP}/app/Providers/SettingsServiceProvider.php" \
    || fail "SettingsServiceProvider.php 에 storage_driver named disk 적용 로직 미적용"
  ok "패치 capsule 필수 심볼 적용 상태"
}

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
[[ "${PATCH_FILES}" -ge 15 && "${PATCH_FILES}" -le 30 ]] \
  || fail "패치 파일 수 비정상: ${PATCH_FILES} (기대 15~30)"

if [[ -n "${BUILD_ID:-}" || -n "${PROJECT_ID:-}" ]]; then
  ok "Cloud Build source tarball 모드 — git reverse-check 대신 capsule 심볼 검증"
  check_patch_capsule_symbols

  echo ""
  if [[ "${FAIL}" -ne 0 ]]; then
    echo "== FAILED: 코어 패치 게이트 =="
    exit 1
  fi

  echo "== PASSED: 코어 패치 게이트 OK (${PATCH_FILES} files, cloudbuild mode) =="
  exit 0
fi

if ! g7_git_setup "${APP}" >/dev/null 2>&1; then
  ok "G7 upstream metadata 없음 — Cloud Build 소스 tarball 모드"
  # Cloud Build 는 .gcloudignore 로 app/.git.g7-upstream-backup 을 업로드하지 않는다.
  # 이 경로에서는 git apply reverse-check 대신, 패치 capsule 과 현재 코어에 필수 심볼이
  # 동시에 존재하는지만 확인한다. 로컬에서는 아래 reverse-check 가 SSOT drift 를 잡는다.
  check_patch_capsule_symbols

  echo ""
  if [[ "${FAIL}" -ne 0 ]]; then
    echo "== FAILED: 코어 패치 게이트 =="
    exit 1
  fi

  echo "== PASSED: 코어 패치 게이트 OK (${PATCH_FILES} files, cloudbuild mode) =="
  exit 0
fi

info="$(g7_git_short_head 2>/dev/null || true)"
[[ -n "${info}" ]] && ok "G7 upstream HEAD: ${info}"

if g7_git apply --check --reverse "${PATCH}" >/dev/null 2>&1; then
  ok "워킹 트리: 패치 적용 상태 (reverse-check)"
  CORE_PATHS=(app config bootstrap routes database/migrations resources/js/core resources/views tests)
  mapfile -t CORE_TRACKED < <(g7_git diff --name-only HEAD -- "${CORE_PATHS[@]}")
  mapfile -t CORE_UNTRACKED < <(g7_git ls-files --others --exclude-standard -- "${CORE_PATHS[@]}")

  CURRENT_CORE_FILES="$(
    {
      printf '%s\n' "${CORE_TRACKED[@]}"
      printf '%s\n' "${CORE_UNTRACKED[@]}"
    } | sed '/^$/d' | sort -u
  )"
  PATCH_CORE_FILES="$(
    grep '^diff --git' "${PATCH}" \
      | sed -E 's#^diff --git a/([^ ]+) b/.*#\1#' \
      | sort -u
  )"

  if [[ "${CURRENT_CORE_FILES}" == "${PATCH_CORE_FILES}" ]]; then
    ok "패치 SSOT: 현재 코어 delta 파일 목록과 일치"
  else
    fail "패치 SSOT 불일치 — deploy/core-patches/regenerate.sh 실행 필요"
    diff -u <(printf '%s\n' "${PATCH_CORE_FILES}") <(printf '%s\n' "${CURRENT_CORE_FILES}") || true
  fi
elif g7_git apply --check "${PATCH}" >/dev/null 2>&1; then
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
