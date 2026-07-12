#!/usr/bin/env bash
set -euo pipefail

_POST_DEPLOY_HASH_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=content-manifest-hash.sh
source "${_POST_DEPLOY_HASH_ROOT}/deploy/lib/content-manifest-hash.sh"

MOABOM_POST_DEPLOY_MANIFEST="${MOABOM_POST_DEPLOY_MANIFEST:-${_POST_DEPLOY_HASH_ROOT}/deploy/ssot/post-deploy-manifest.sha256}"

moabom_post_deploy_module_migration_digest() {
  local module_id="$1"
  local mig_dir="${_POST_DEPLOY_HASH_ROOT}/app/modules/${module_id}/database/migrations"
  if [[ ! -d "${mig_dir}" ]]; then
    echo "module:${module_id}:none"
    return 0
  fi
  moabom_content_manifest_digest "module:${module_id}" "${mig_dir}"
}

moabom_post_deploy_platform_migration_digest() {
  local key="$1"
  local rel_path="$2"
  local mig_dir="${_POST_DEPLOY_HASH_ROOT}/${rel_path}"
  if [[ ! -d "${mig_dir}" ]]; then
    echo "platform:${key}:none"
    return 0
  fi
  moabom_content_manifest_digest "platform:${key}" "${mig_dir}"
}

moabom_post_deploy_phase_e_digest() {
  moabom_content_manifest_digest "phase-e" \
    "app/modules/moabom-system/database/migrations/platform" \
    "app/modules/moabom-system/src/Console/Commands/SaasNormalizeAdminCredentialsCommand.php"
}

moabom_post_deploy_module_migration_changed() {
  local module_id="$1"
  if [[ "${MOABOM_FORCE_POST_DEPLOY_MIGRATE:-0}" == "1" ]]; then
    return 0
  fi
  local current stored current_hash
  current="$(moabom_post_deploy_module_migration_digest "${module_id}")"
  current_hash="${current##*:}"
  if [[ "${current_hash}" == "none" ]]; then
    return 1
  fi
  stored="$(moabom_content_manifest_read_entry "${MOABOM_POST_DEPLOY_MANIFEST}" "module:${module_id}" 2>/dev/null || true)"
  [[ -z "${stored}" || "${stored}" != "${current_hash}" ]]
}

moabom_post_deploy_platform_migration_changed() {
  local key="$1"
  local rel_path="$2"
  if [[ "${MOABOM_FORCE_POST_DEPLOY_MIGRATE:-0}" == "1" ]]; then
    return 0
  fi
  local current stored current_hash
  current="$(moabom_post_deploy_platform_migration_digest "${key}" "${rel_path}")"
  current_hash="${current##*:}"
  if [[ "${current_hash}" == "none" ]]; then
    return 1
  fi
  stored="$(moabom_content_manifest_read_entry "${MOABOM_POST_DEPLOY_MANIFEST}" "platform:${key}" 2>/dev/null || true)"
  [[ -z "${stored}" || "${stored}" != "${current_hash}" ]]
}

moabom_post_deploy_phase_e_changed() {
  if [[ "${MOABOM_FORCE_PHASE_E:-0}" == "1" ]]; then
    return 0
  fi
  local current stored current_hash
  current="$(moabom_post_deploy_phase_e_digest)"
  current_hash="${current##*:}"
  stored="$(moabom_content_manifest_read_entry "${MOABOM_POST_DEPLOY_MANIFEST}" "phase-e" 2>/dev/null || true)"
  [[ -z "${stored}" || "${stored}" != "${current_hash}" ]]
}

moabom_post_deploy_record_module_migration() {
  local module_id="$1"
  local current digest
  current="$(moabom_post_deploy_module_migration_digest "${module_id}")"
  digest="${current##*:}"
  moabom_content_manifest_write_entry "${MOABOM_POST_DEPLOY_MANIFEST}" "module:${module_id}" "${digest}"
}

moabom_post_deploy_record_platform_migration() {
  local key="$1"
  local rel_path="$2"
  local current digest
  current="$(moabom_post_deploy_platform_migration_digest "${key}" "${rel_path}")"
  digest="${current##*:}"
  moabom_content_manifest_write_entry "${MOABOM_POST_DEPLOY_MANIFEST}" "platform:${key}" "${digest}"
}

moabom_post_deploy_record_phase_e() {
  local current digest
  current="$(moabom_post_deploy_phase_e_digest)"
  digest="${current##*:}"
  moabom_content_manifest_write_entry "${MOABOM_POST_DEPLOY_MANIFEST}" "phase-e" "${digest}"
}

# RF-31: moabom-* 외에도 활성 의존 모듈(sirsoft-board) schema 는 이미지와 같이 맞춰야 함.
# post-deploy allowlist 에 포함할 추가 모듈 id (공백 구분).
MOABOM_POST_DEPLOY_MIGRATION_EXTRA_MODULES="${MOABOM_POST_DEPLOY_MIGRATION_EXTRA_MODULES:-sirsoft-board}"

moabom_post_deploy_migration_module_allowed() {
  local module_id="$1"
  [[ "${module_id}" == moabom-* ]] && return 0
  local extra
  for extra in ${MOABOM_POST_DEPLOY_MIGRATION_EXTRA_MODULES}; do
    [[ "${module_id}" == "${extra}" ]] && return 0
  done
  return 1
}

# auto — migration 파일 해시가 바뀐 moabom-* (+ RF-31 extra) 모듈만
moabom_post_deploy_auto_migration_modules() {
  local module_dir module_id extra
  for module_dir in "${_POST_DEPLOY_HASH_ROOT}/app/modules"/moabom-*/; do
    [[ -d "${module_dir}/database/migrations" ]] || continue
    module_id="$(basename "${module_dir}")"
    if moabom_post_deploy_module_migration_changed "${module_id}"; then
      printf '%s\n' "${module_id}"
    fi
  done
  for extra in ${MOABOM_POST_DEPLOY_MIGRATION_EXTRA_MODULES}; do
    [[ -d "${_POST_DEPLOY_HASH_ROOT}/app/modules/${extra}/database/migrations" ]] || continue
    if moabom_post_deploy_module_migration_changed "${extra}"; then
      printf '%s\n' "${extra}"
    fi
  done
}
