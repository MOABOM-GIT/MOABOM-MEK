#!/usr/bin/env bash
# G7 upstream 전 안전 작업 통합 게이트 (코어 PR·core:update 준비)
# Usage: bash deploy/check-upstream-prep.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

run_gate() {
  local name="$1"
  shift
  echo ""
  echo "######## ${name} ########"
  if "$@"; then
    echo ">> ${name}: PASS"
  else
    echo ">> ${name}: FAIL"
    FAIL=1
  fi
}

echo "== check-upstream-prep (G7 upstream 전) =="

run_gate "core-patches" bash "${ROOT}/deploy/check-core-patches.sh"
run_gate "g7-core-guards" bash "${ROOT}/deploy/check-g7-core-guard-regression.sh"
run_gate "bundled-detach" bash "${ROOT}/deploy/check-bundled-detach-regression.sh"
run_gate "core-sync" bash "${ROOT}/deploy/check-core-sync-regression.sh"
run_gate "admin-semantic-css" bash "${ROOT}/deploy/sync-g7-admin-semantic-css.sh" --check
run_gate "upstream-dry-run" bash "${ROOT}/deploy/dry-run-upstream-patches.sh"

echo ""
if [[ "${FAIL}" -ne 0 ]]; then
  echo "== FAILED: upstream 준비 게이트 =="
  exit 1
fi
echo "== PASSED: upstream 준비 게이트 OK =="
