#!/usr/bin/env bash
# tenant legacy moabom_system_generated_apps 잔여 행 일괄 삭제 (platform SSOT — tenant DB ghost 정리)
#
# Usage:
#   bash deploy/run-purge-tenant-legacy-generated.sh --dry-run
#   bash deploy/run-purge-tenant-legacy-generated.sh --force
#
# 전제: 이미지에 moabom:apps:purge-tenant-legacy-generated 명령 포함 (배포 후 실행)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TIMEOUT="${MOABOM_PURGE_LEGACY_TIMEOUT:-900s}"

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

args=(moabom:apps:purge-tenant-legacy-generated --no-interaction)
if [[ "${dry_run}" -eq 1 ]]; then
  args+=(--dry-run)
fi
if [[ "${force}" -eq 1 ]]; then
  args+=(--force)
fi

echo "[purge-tenant-legacy-generated] image=$(moabom_image_tag) args=${args[*]}"
moabom_run_artisan_job moabom-apps-purge-tenant-legacy-generated "${TIMEOUT}" "${args[@]}"
