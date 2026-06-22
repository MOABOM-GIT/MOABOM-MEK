#!/usr/bin/env bash
# 레거시 visibility=global → tenant 범위 1회 정리 (배포 파이프라인 제외 — 필요 시 수동)
#
# Usage:
#   bash deploy/run-repair-legacy-global-visibility.sh --dry-run
#   bash deploy/run-repair-legacy-global-visibility.sh --force
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TIMEOUT="${MOABOM_REPAIR_LEGACY_VISIBILITY_TIMEOUT:-900s}"

# shellcheck source=lib/cloud-run-artisan-job.sh
source "${ROOT}/deploy/lib/cloud-run-artisan-job.sh"

dry_run=0
force=0
for arg in "$@"; do
  case "${arg}" in
    --dry-run) dry_run=1 ;;
    --force) force=1 ;;
    *)
      echo "Unknown arg: ${arg} (use --dry-run or --force)" >&2
      exit 1
      ;;
  esac
done

if [[ "${dry_run}" -eq 0 && "${force}" -eq 0 ]]; then
  echo "Specify --dry-run or --force" >&2
  exit 1
fi

args=(moabom:apps:repair-legacy-global-visibility --no-interaction)
if [[ "${dry_run}" -eq 1 ]]; then
  args+=(--dry-run)
fi
if [[ "${force}" -eq 1 ]]; then
  args+=(--force)
fi

echo "[repair-legacy-global-visibility] image=$(moabom_image_tag) args=${args[*]}"
moabom_run_artisan_job moabom-apps-repair-legacy-global-visibility "${TIMEOUT}" "${args[@]}"
