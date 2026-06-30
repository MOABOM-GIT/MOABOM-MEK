#!/usr/bin/env bash
set -euo pipefail

_LAYOUT_SYNC_HASH_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=content-manifest-hash.sh
source "${_LAYOUT_SYNC_HASH_ROOT}/deploy/lib/content-manifest-hash.sh"

MOABOM_LAYOUT_SYNC_MANIFEST="${MOABOM_LAYOUT_SYNC_MANIFEST:-${_LAYOUT_SYNC_HASH_ROOT}/deploy/ssot/layout-sync-manifest.sha256}"
MOABOM_LAYOUT_SYNC_MANIFEST_LABEL="layout-sync"
MOABOM_PLATFORM_DB_LAYOUT_VERSIONS="${MOABOM_PLATFORM_DB_LAYOUT_VERSIONS:-${_LAYOUT_SYNC_HASH_ROOT}/deploy/ssot/platform-db-layout-versions.env}"
MOABOM_REALTIME_VM_LAYOUT_JSON="${_LAYOUT_SYNC_HASH_ROOT}/app/modules/moabom-system/resources/layouts/admin/admin_realtime_vm.json"

moabom_platform_db_layout_version() {
  local key="$1"
  if [[ ! -f "${MOABOM_PLATFORM_DB_LAYOUT_VERSIONS}" ]]; then
    echo ""
    return 0
  fi
  grep -E "^${key}=" "${MOABOM_PLATFORM_DB_LAYOUT_VERSIONS}" 2>/dev/null | tail -1 | cut -d= -f2- || true
}

moabom_filesystem_realtime_vm_layout_version() {
  if [[ ! -f "${MOABOM_REALTIME_VM_LAYOUT_JSON}" ]]; then
    echo ""
    return 0
  fi
  python3 - "${MOABOM_REALTIME_VM_LAYOUT_JSON}" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as f:
    print(str(json.load(f).get("version", "")))
PY
}

# aggregate manifest 가 같아도 platform DB module layout 이 구형이면 sync 필수 (RF-14 realtime-vm)
moabom_platform_module_layout_version_stale() {
  local fs_version db_version
  fs_version="$(moabom_filesystem_realtime_vm_layout_version)"
  db_version="$(moabom_platform_db_layout_version admin_realtime_vm)"
  if [[ -z "${fs_version}" ]]; then
    return 1
  fi
  if [[ -z "${db_version}" || "${db_version}" != "${fs_version}" ]]; then
    echo "layout-sync: platform DB marker admin_realtime_vm=${db_version:-∅} != filesystem ${fs_version}"
    return 0
  fi
  return 1
}

moabom_layout_sync_record_platform_layout_versions() {
  local fs_version versions_file tmp
  fs_version="$(moabom_filesystem_realtime_vm_layout_version)"
  [[ -n "${fs_version}" ]] || return 0
  versions_file="${MOABOM_PLATFORM_DB_LAYOUT_VERSIONS}"
  mkdir -p "$(dirname "${versions_file}")"
  tmp="$(mktemp)"
  if [[ -f "${versions_file}" ]]; then
    grep -v '^admin_realtime_vm=' "${versions_file}" > "${tmp}" || true
  fi
  printf 'admin_realtime_vm=%s\n' "${fs_version}" >> "${tmp}"
  mv "${tmp}" "${versions_file}"
}

moabom_layout_sync_collect_files() {
  local root="${_LAYOUT_SYNC_HASH_ROOT}"
  local list
  list="$(mktemp)"
  {
    find "${root}/app/templates/moabom-admin_basic/layouts" -type f -name '*.json' 2>/dev/null || true
    find "${root}/app/templates/moabom-basic/layouts" -type f -name '*.json' 2>/dev/null || true
    find "${root}/app/modules" -path '*/resources/layouts/*.json' -type f 2>/dev/null || true
    # module.php 는 권한·메뉴·역할 선언 SSOT — 변경 시 sync-module-declarations 가 돌아야
    # admin 권한 grant 가 운영 DB 에 반영된다. 특정 모듈만 넣으면 신규 권한이 영구 skip 된다.
    find "${root}/app/modules" -maxdepth 2 -name 'module.php' -type f 2>/dev/null || true
    find "${root}/app/lang-packs" -type f \
      \( -path '*/g7-module-moabom-*/*' -o -path '*/g7-template-moabom-*/*' \) 2>/dev/null || true
  } | sort -u > "${list}"
  echo "${list}"
}

moabom_layout_sync_compute_digest() {
  local label="${MOABOM_LAYOUT_SYNC_MANIFEST_LABEL}"
  local list tmp
  list="$(moabom_layout_sync_collect_files)"
  tmp="$(mktemp)"
  trap 'rm -f "${list}" "${tmp}"' RETURN

  if [[ ! -s "${list}" ]]; then
    echo "${label}:empty"
    return 0
  fi

  while IFS= read -r file; do
    [[ -f "${file}" ]] || continue
    sha256sum "${file}"
  done < "${list}" | sha256sum | awk -v label="${label}" '{print label ":" $1}'
}

moabom_layout_sync_needed() {
  if [[ "${MOABOM_FORCE_LAYOUT_SYNC:-0}" == "1" ]]; then
    echo "layout-sync: forced (MOABOM_FORCE_LAYOUT_SYNC=1)"
    return 0
  fi
  if moabom_platform_module_layout_version_stale; then
    return 0
  fi
  local current stored current_hash
  current="$(moabom_layout_sync_compute_digest)"
  current_hash="${current##*:}"
  stored="$(moabom_content_manifest_read_entry "${MOABOM_LAYOUT_SYNC_MANIFEST}" "${MOABOM_LAYOUT_SYNC_MANIFEST_LABEL}" 2>/dev/null || true)"
  if [[ -z "${stored}" ]]; then
    echo "layout-sync: no manifest — first run or manifest missing"
    return 0
  fi
  if [[ "${stored}" != "${current_hash}" ]]; then
    echo "layout-sync: content changed (${stored:0:8}… → ${current_hash:0:8}…)"
    return 0
  fi
  echo "layout-sync: unchanged — skip"
  return 1
}

moabom_layout_sync_record_success() {
  local current digest
  current="$(moabom_layout_sync_compute_digest)"
  digest="${current##*:}"
  moabom_content_manifest_write_entry "${MOABOM_LAYOUT_SYNC_MANIFEST}" "${MOABOM_LAYOUT_SYNC_MANIFEST_LABEL}" "${digest}"
  moabom_layout_sync_record_platform_layout_versions
  echo "layout-sync manifest updated: ${digest:0:12}…"
}
