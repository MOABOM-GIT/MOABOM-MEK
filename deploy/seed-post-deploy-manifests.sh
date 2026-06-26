#!/usr/bin/env bash
# 현재 워킹트리 기준 post-deploy manifest 시드 — 변경 없는 배포에서 Job 생략
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/layout-sync-hash.sh
source "${ROOT}/deploy/lib/layout-sync-hash.sh"
# shellcheck source=lib/post-deploy-migration-hash.sh
source "${ROOT}/deploy/lib/post-deploy-migration-hash.sh"

echo "== seed-post-deploy-manifests =="

moabom_layout_sync_record_success

for module_dir in "${ROOT}/app/modules"/moabom-*/; do
  [[ -d "${module_dir}/database/migrations" ]] || continue
  module_id="$(basename "${module_dir}")"
  moabom_post_deploy_record_module_migration "${module_id}"
  echo "  module:${module_id}"
done

for key_path in \
  "moabom-apps:app/modules/moabom-apps/database/migrations/platform" \
  "moabom-presence:app/modules/moabom-presence/database/migrations/platform" \
  "moabom-system:app/modules/moabom-system/database/migrations/platform"; do
  key="${key_path%%:*}"
  rel="${key_path#*:}"
  moabom_post_deploy_record_platform_migration "${key}" "${rel}"
  echo "  platform:${key}"
done

moabom_post_deploy_record_phase_e
echo "  phase-e"

echo "== seed-post-deploy-manifests done =="
