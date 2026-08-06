#!/usr/bin/env bash
# RF-32 — migration plane 목록·해시 (core / module / plugin)
# shellcheck disable=SC2034
set -euo pipefail

_SAAS_PLANE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=content-manifest-hash.sh
source "${_SAAS_PLANE_ROOT}/deploy/lib/content-manifest-hash.sh"
# shellcheck source=post-deploy-migration-hash.sh
source "${_SAAS_PLANE_ROOT}/deploy/lib/post-deploy-migration-hash.sh"

MOABOM_POST_DEPLOY_MANIFEST="${MOABOM_POST_DEPLOY_MANIFEST:-${_SAAS_PLANE_ROOT}/deploy/ssot/post-deploy-manifest.sha256}"

moabom_saas_plane_digest() {
  local key="$1"
  local rel_path="$2"
  local mig_dir="${_SAAS_PLANE_ROOT}/app/${rel_path}"
  if [[ ! -d "${mig_dir}" ]]; then
    echo "${key}:none"
    return 0
  fi
  moabom_content_manifest_digest "${key}" "${mig_dir}"
}

moabom_saas_plane_changed() {
  local key="$1"
  local rel_path="$2"
  if [[ "${MOABOM_FORCE_POST_DEPLOY_MIGRATE:-0}" == "1" ]]; then
    return 0
  fi
  local current stored current_hash
  current="$(moabom_saas_plane_digest "${key}" "${rel_path}")"
  current_hash="${current##*:}"
  if [[ "${current_hash}" == "none" ]]; then
    return 1
  fi
  stored="$(moabom_content_manifest_read_entry "${MOABOM_POST_DEPLOY_MANIFEST}" "${key}" 2>/dev/null || true)"
  [[ -z "${stored}" || "${stored}" != "${current_hash}" ]]
}

moabom_saas_plane_record() {
  local key="$1"
  local rel_path="$2"
  local current digest
  current="$(moabom_saas_plane_digest "${key}" "${rel_path}")"
  digest="${current##*:}"
  [[ "${digest}" == "none" ]] && return 0
  moabom_content_manifest_write_entry "${MOABOM_POST_DEPLOY_MANIFEST}" "${key}" "${digest}"
}

# stdout: "key|path" per line (path relative to app/)
moabom_saas_list_changed_planes() {
  local mig_dir id rel key
  if moabom_saas_plane_changed "core" "database/migrations"; then
    printf '%s\n' "core|database/migrations"
  fi

  for mig_dir in "${_SAAS_PLANE_ROOT}/app/modules"/*/database/migrations; do
    [[ -d "${mig_dir}" ]] || continue
    # top-level php only (skip empty / platform-only trees)
    if ! compgen -G "${mig_dir}/*.php" > /dev/null; then
      continue
    fi
    id="$(basename "$(dirname "$(dirname "${mig_dir}")")")"
    rel="modules/${id}/database/migrations"
    key="module:${id}"
    if moabom_saas_plane_changed "${key}" "${rel}"; then
      printf '%s\n' "${key}|${rel}"
    fi
  done

  for mig_dir in "${_SAAS_PLANE_ROOT}/app/plugins"/*/database/migrations; do
    [[ -d "${mig_dir}" ]] || continue
    if ! compgen -G "${mig_dir}/*.php" > /dev/null; then
      continue
    fi
    id="$(basename "$(dirname "$(dirname "${mig_dir}")")")"
    rel="plugins/${id}/database/migrations"
    key="plugin:${id}"
    if moabom_saas_plane_changed "${key}" "${rel}"; then
      printf '%s\n' "${key}|${rel}"
    fi
  done
}

moabom_saas_record_planes_from_list() {
  local line key path
  while IFS= read -r line; do
    [[ -n "${line}" ]] || continue
    key="${line%%|*}"
    path="${line#*|}"
    moabom_saas_plane_record "${key}" "${path}"
  done
}
