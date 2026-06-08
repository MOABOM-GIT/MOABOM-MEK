#!/usr/bin/env bash
# G7 upstream(beta.7 HEAD) 기준 패치 dry-run — 네트워크 없이 로컬 git archive 사용
# Usage: bash deploy/dry-run-upstream-patches.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${ROOT}/app"
CORE_PATCH="${ROOT}/deploy/core-patches/moabom-core.patch"
HOOKS_PATCH="${ROOT}/deploy/core-patches/g7-upstream-hooks.patch"
# shellcheck source=lib/g7-worktree.sh
source "${ROOT}/deploy/lib/g7-worktree.sh"

TMP=""
cleanup() { [[ -n "${TMP}" && -d "${TMP}" ]] && rm -rf "${TMP}"; }
trap cleanup EXIT

g7_git_setup "${APP}"
TMP="$(mktemp -d)"

echo "== dry-run-upstream-patches =="
echo "G7 HEAD: $(g7_git_short_head)"

g7_git archive HEAD | tar -x -C "${TMP}"
[[ -f "${TMP}/app/Http/Controllers/Api/Public/PublicTemplateController.php" ]] \
  || { echo "FAIL: G7 archive 추출 불완전"; exit 1; }

check_apply() {
  local label="$1"
  local patch="$2"
  echo ""
  echo "-- ${label}"
  if [[ ! -f "${patch}" ]]; then
    echo "FAIL: 패치 없음 ${patch}"
    return 1
  fi
  # git diff 경로 a/app/... → strip 1 (기본값). -p0 이면 a/ 접두가 남아 실패한다.
  if (cd "${TMP}" && git apply --check "${patch}"); then
    echo "OK: clean apply"
    return 0
  fi
  echo "FAIL: apply --check"
  return 1
}

FAIL=0
check_apply "moabom-core.patch (pristine → patched)" "${CORE_PATCH}" || FAIL=1
check_apply "g7-upstream-hooks.patch (pristine → hooks)" "${HOOKS_PATCH}" || FAIL=1

echo ""
if [[ "${FAIL}" -ne 0 ]]; then
  echo "== FAILED: upstream 패치 dry-run =="
  exit 1
fi
echo "== PASSED: upstream 패치 dry-run OK =="
