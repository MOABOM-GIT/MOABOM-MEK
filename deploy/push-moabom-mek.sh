#!/usr/bin/env bash
# MOABOM-MEK → GitHub push (SSH: ~/.ssh/moabom_key 또는 MOABOM_SSH_KEY)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

REMOTE="${MOABOM_GIT_REMOTE:-origin}"
BRANCH="${MOABOM_GIT_BRANCH:-main}"
URL="${MOABOM_GIT_URL:-git@github.com:MOABOM-GIT/MOABOM-MEK.git}"
SSH_KEY="${MOABOM_SSH_KEY:-${HOME}/.ssh/moabom_key}"

if [[ -f "${SSH_KEY}" ]]; then
  export GIT_SSH_COMMAND="ssh -i ${SSH_KEY} -o IdentitiesOnly=yes"
fi

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "ERROR: ${ROOT} 에 git 저장소 없음"
  exit 1
fi

if ! git remote get-url "${REMOTE}" >/dev/null 2>&1; then
  git remote add "${REMOTE}" "${URL}"
fi

echo "==> push ${REMOTE}/${BRANCH}"
git push -u "${REMOTE}" "${BRANCH}"

echo "==> done: ${URL}"
