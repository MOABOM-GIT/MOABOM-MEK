#!/usr/bin/env bash
set -euo pipefail

_LAYOUT_SYNC_HASH_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=content-manifest-hash.sh
source "${_LAYOUT_SYNC_HASH_ROOT}/deploy/lib/content-manifest-hash.sh"

MOABOM_LAYOUT_SYNC_MANIFEST="${MOABOM_LAYOUT_SYNC_MANIFEST:-${_LAYOUT_SYNC_HASH_ROOT}/deploy/ssot/layout-sync-manifest.sha256}"
MOABOM_LAYOUT_SYNC_MANIFEST_LABEL="layout-sync"
MOABOM_PLATFORM_DB_LAYOUT_VERSIONS="${MOABOM_PLATFORM_DB_LAYOUT_VERSIONS:-${_LAYOUT_SYNC_HASH_ROOT}/deploy/ssot/platform-db-layout-versions.env}"

moabom_platform_db_layout_version() {
  local key="$1"
  if [[ ! -f "${MOABOM_PLATFORM_DB_LAYOUT_VERSIONS}" ]]; then
    echo ""
    return 0
  fi
  grep -E "^${key}=" "${MOABOM_PLATFORM_DB_LAYOUT_VERSIONS}" 2>/dev/null | tail -1 | cut -d= -f2- || true
}

# aggregate manifest 가 같아도 platform module layouts 는 별도 reconcile Job(RF-13b)이 매 배포 처리한다.
# 아래 marker 는 reconcile 성공 후 기록용이며, layout sync skip 판정에는 사용하지 않는다.
moabom_platform_module_layout_version_stale() {
  return 1
}

moabom_layout_sync_record_platform_layout_versions() {
  local versions_file tmp
  versions_file="${MOABOM_PLATFORM_DB_LAYOUT_VERSIONS}"
  mkdir -p "$(dirname "${versions_file}")"
  tmp="$(mktemp)"
  python3 - "${_LAYOUT_SYNC_HASH_ROOT}" > "${tmp}" <<'PY'
import glob
import json
import os
import sys

root = sys.argv[1]
entries = []
for path in sorted(glob.glob(os.path.join(root, "app/modules/*/resources/layouts/admin/*.json"))):
    module = path.split("/modules/")[1].split("/")[0]
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    base = str(data.get("layout_name") or os.path.splitext(os.path.basename(path))[0])
    version = str(data.get("version", "0"))
    entries.append(f"{module}.{base}={version}\n")
for path in sorted(glob.glob(os.path.join(root, "app/modules/*/resources/layouts/user/*.json"))):
    module = path.split("/modules/")[1].split("/")[0]
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    base = str(data.get("layout_name") or os.path.splitext(os.path.basename(path))[0])
    version = str(data.get("version", "0"))
    entries.append(f"{module}.{base}={version}\n")
sys.stdout.writelines(entries)
PY
  {
    echo "# platform DB module layouts — reconcile Job 성공 후 기록 (운영 DB 실측 SSOT 아님, 감사용)"
    echo "# layout sync skip 판정은 manifest 해시만 사용. module layout 정합은 run-platform-module-layout-reconcile-job.sh 가 매 배포 수행."
    cat "${tmp}"
  } > "${versions_file}"
  rm -f "${tmp}"
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
