#!/usr/bin/env bash
# Moabom 최소 코어 패치 정합성 — core:update / 업스트림 전 회귀 게이트
# Usage: bash deploy/check-core-patches.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${ROOT}/app"
PATCH="${ROOT}/deploy/core-patches/moabom-core.patch"
APPLY="${ROOT}/deploy/core-patches/apply-core-patches.sh"
MANIFEST="${ROOT}/deploy/core-overlay/manifest.json"
# shellcheck source=lib/g7-worktree.sh
source "${ROOT}/deploy/lib/g7-worktree.sh"
FAIL=0

fail() { echo "FAIL: $*"; FAIL=1; }
ok()   { echo "OK:   $*"; }

patch_files_from_patch() {
  grep '^diff --git' "${PATCH}" \
    | sed -E 's#^diff --git a/([^ ]+) b/.*#\1#' \
    | sort -u
}

patch_files_from_manifest() {
  python3 - "${MANIFEST}" <<'PY'
import json
import sys

manifest = json.load(open(sys.argv[1], encoding='utf-8'))
paths = []
for items in manifest["categories"].values():
    paths.extend(item["path"] for item in items)
for path in sorted(set(paths)):
    print(path)
PY
}

check_overlay_manifest() {
  [[ -f "${MANIFEST}" ]] || { fail "core overlay manifest 없음: ${MANIFEST}"; return; }

  local patch_list manifest_list
  patch_list="$(patch_files_from_patch)"
  manifest_list="$(patch_files_from_manifest)"

  if [[ "${patch_list}" == "${manifest_list}" ]]; then
    ok "overlay manifest: 패치 파일 목록과 일치"
  else
    fail "overlay manifest 불일치 — deploy/core-overlay/manifest.json 갱신 필요"
    diff -u <(printf '%s\n' "${manifest_list}") <(printf '%s\n' "${patch_list}") || true
  fi

  if grep -qE '^diff --git a/(tests/|.*/__tests__/)' "${PATCH}"; then
    fail "moabom-core.patch 에 코어 tests/ 델타 금지 — deploy/module gate 로 이동"
  else
    ok "moabom-core.patch: 코어 tests/ 델타 없음"
  fi

  if grep -qE 'loadDeferredExtensionAssets|isFileLike' "${PATCH}"; then
    fail "moabom-core.patch 에 ActionDispatcher 커스텀 핸들러/파일 유틸 잔여물 금지"
  else
    ok "moabom-core.patch: ActionDispatcher 커스텀 핸들러/파일 유틸 잔여물 없음"
  fi
}

check_fresh_upstream_apply() {
  if [[ "${MOABOM_SKIP_FRESH_G7_DRY_RUN:-0}" == "1" ]]; then
    ok "fresh G7 patch dry-run: skipped (MOABOM_SKIP_FRESH_G7_DRY_RUN=1)"
    return
  fi

  local upstream_dir="${MOABOM_G7_FRESH_CLONE_DIR:-/tmp/gnuboard-g7}"
  if [[ ! -d "${upstream_dir}/.git" ]]; then
    rm -rf "${upstream_dir}"
    if git clone --depth 1 https://github.com/gnuboard/g7.git "${upstream_dir}" >/dev/null 2>&1; then
      ok "fresh G7 clone 준비: ${upstream_dir}"
    else
      fail "fresh G7 clone 실패 — 네트워크/권한 확인 필요: ${upstream_dir}"
      return
    fi
  else
    git -C "${upstream_dir}" fetch --depth 1 origin main >/dev/null 2>&1 || true
    git -C "${upstream_dir}" reset --hard FETCH_HEAD >/dev/null 2>&1 || true
    git -C "${upstream_dir}" clean -fd >/dev/null 2>&1 || true
    ok "fresh G7 clone 재사용: ${upstream_dir}"
  fi

  if git -C "${upstream_dir}" apply --check "${PATCH}" >/dev/null 2>&1; then
    ok "fresh G7 patch dry-run: 적용 가능"
  else
    fail "fresh G7 patch dry-run 실패 — upstream 충돌 또는 패치 context drift"
  fi
}

check_patch_capsule_symbols() {
  grep -q 'config/moabom-saas.php' "${PATCH}" \
    || fail "moabom-core.patch 에 config/moabom-saas.php 누락"
  grep -q 'reloadModuleHandlers' "${APP}/resources/js/core/template-engine/ActionDispatcher.ts" \
    || fail "ActionDispatcher.ts 에 G7 순정 reloadModuleHandlers 누락"
  grep -q 'reloadPluginHandlers' "${APP}/resources/js/core/template-engine/ActionDispatcher.ts" \
    || fail "ActionDispatcher.ts 에 G7 순정 reloadPluginHandlers 누락"
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
MANIFEST_FILES="$(patch_files_from_manifest | wc -l | tr -d ' ')"
[[ "${PATCH_FILES}" == "${MANIFEST_FILES}" ]] \
  || fail "패치 파일 수 비정상: ${PATCH_FILES} (manifest ${MANIFEST_FILES})"
check_overlay_manifest

if [[ -n "${BUILD_ID:-}" || -n "${PROJECT_ID:-}" ]]; then
  ok "Cloud Build source tarball 모드 — capsule 심볼 + fresh upstream dry-run 검증"
  check_patch_capsule_symbols
  check_fresh_upstream_apply

  echo ""
  if [[ "${FAIL}" -ne 0 ]]; then
    echo "== FAILED: 코어 패치 게이트 =="
    exit 1
  fi

  echo "== PASSED: 코어 패치 게이트 OK (${PATCH_FILES} files, cloudbuild mode) =="
  exit 0
fi

if ! g7_git_setup "${APP}" >/dev/null 2>&1; then
  ok "G7 upstream metadata 없음 — fresh upstream dry-run fallback"
  # Cloud Build 는 .gcloudignore 로 app/.git.g7-upstream-backup 을 업로드하지 않는다.
  # 이 경로에서는 현재 코어의 필수 심볼과 fresh G7 clone 기준 patch dry-run 을 함께 검증한다.
  check_patch_capsule_symbols
  check_fresh_upstream_apply

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
  CORE_PATHS=(app config bootstrap routes database/migrations resources/js/core resources/views)
  mapfile -t CORE_TRACKED < <(g7_git diff --name-only HEAD -- "${CORE_PATHS[@]}")
  mapfile -t CORE_UNTRACKED < <(g7_git ls-files --others --exclude-standard -- "${CORE_PATHS[@]}")

  CURRENT_CORE_FILES="$(
    {
      printf '%s\n' "${CORE_TRACKED[@]}"
      printf '%s\n' "${CORE_UNTRACKED[@]}"
    } | sed '/^$/d' | grep -Ev '^tests/|/__tests__/' | sort -u
  )"
  PATCH_CORE_FILES="$(patch_files_from_patch)"

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
