#!/usr/bin/env bash
# MOABOM-MEK 모노레포: app/ G7 upstream worktree (detached .git.g7-upstream-backup)
#
# app/.git 은 모노레포 전환 시 .git.g7-upstream-backup 으로 이동했다.
# 패치 apply/check·regenerate 는 GIT_DIR/GIT_WORK_TREE 로 동일하게 동작한다.
#
# Usage:
#   source deploy/lib/g7-worktree.sh
#   g7_git_setup "${APP}"
#   g7_git apply --check --reverse "${PATCH}"
#
set -euo pipefail

G7_APP=""
G7_GIT_DIR=""

g7_git_setup() {
  local app="${1:?G7 app directory required}"
  G7_APP="$(cd "${app}" && pwd)"
  G7_GIT_DIR="${G7_APP}/.git.g7-upstream-backup"
  if [[ ! -d "${G7_GIT_DIR}" ]]; then
    echo "ERROR: G7 upstream git metadata 없음: ${G7_GIT_DIR}" >&2
    echo "       MOABOM-MEK 전환 시 app/.git → .git.g7-upstream-backup 백업 필요" >&2
    return 1
  fi
}

g7_git() {
  if [[ -z "${G7_APP}" || -z "${G7_GIT_DIR}" ]]; then
    echo "ERROR: g7_git_setup() 를 먼저 호출하세요" >&2
    return 1
  fi
  GIT_DIR="${G7_GIT_DIR}" GIT_WORK_TREE="${G7_APP}" git -C "${G7_APP}" "$@"
}

g7_git_head() {
  g7_git rev-parse HEAD
}

g7_git_short_head() {
  g7_git log -1 --format='%h %s'
}
