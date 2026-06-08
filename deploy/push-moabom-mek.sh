#!/usr/bin/env bash
# MOABOM-MEK → GitHub push (최초 1회: gh auth login 또는 SSH remote 설정 필요)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

REMOTE="${MOABOM_GIT_REMOTE:-origin}"
BRANCH="${MOABOM_GIT_BRANCH:-main}"
URL="${MOABOM_GIT_URL:-https://github.com/MOABOM-GIT/MOABOM-MEK.git}"

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
