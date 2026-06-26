#!/usr/bin/env bash
# deploy/ssot/*.sha256 — 배포 post-deploy 입력물 지문 (변경 시에만 Job 실행)
set -euo pipefail

_moabom_manifest_root() {
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  echo "${here}"
}

# @param label @paths... — 존재하는 파일만 정렬 후 단일 sha256
moabom_content_manifest_digest() {
  local label="$1"
  shift
  local root list
  root="$(_moabom_manifest_root)"
  list="$(mktemp)"
  # shellcheck disable=SC2064
  trap "rm -f '${list}'" RETURN

  while [[ $# -gt 0 ]]; do
    local pattern="$1"
    shift
    if [[ "${pattern}" == /* ]]; then
      if [[ -e "${pattern}" ]]; then
        if [[ -d "${pattern}" ]]; then
          find "${pattern}" -type f 2>/dev/null >> "${list}" || true
        else
          printf '%s\n' "${pattern}" >> "${list}"
        fi
      fi
    else
      find "${root}/${pattern}" -type f 2>/dev/null >> "${list}" || true
    fi
  done

  if [[ ! -s "${list}" ]]; then
    echo "${label}:empty"
    return 0
  fi

  sort -u "${list}" | while IFS= read -r file; do
    [[ -f "${file}" ]] || continue
    sha256sum "${file}"
  done | sha256sum | awk -v label="${label}" '{print label ":" $1}'
}

moabom_content_manifest_read_entry() {
  local file="$1"
  local label="$2"
  [[ -f "${file}" ]] || return 1
  awk -F '\t' -v label="${label}" '$1 == label { print $2; exit }' "${file}" 2>/dev/null || return 1
}

moabom_content_manifest_write_entry() {
  local file="$1"
  local label="$2"
  local digest="$3"
  local dir tmp
  dir="$(dirname "${file}")"
  mkdir -p "${dir}"
  tmp="$(mktemp)"
  if [[ -f "${file}" ]]; then
    awk -F '\t' -v label="${label}" '$1 != label { print }' "${file}" > "${tmp}" 2>/dev/null || true
  fi
  printf '%s\t%s\n' "${label}" "${digest}" >> "${tmp}"
  sort -u -o "${file}" "${tmp}"
  rm -f "${tmp}"
}

moabom_content_manifest_entry_changed() {
  local file="$1"
  local label="$2"
  local current_digest="$3"
  local stored
  stored="$(moabom_content_manifest_read_entry "${file}" "${label}" 2>/dev/null || true)"
  [[ -z "${stored}" || "${stored}" != "${current_digest}" ]]
}
