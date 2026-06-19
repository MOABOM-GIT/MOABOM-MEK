#!/usr/bin/env bash
#
# Moabom 코어 overlay 패치 적용 스크립트
# ---------------------------------------------------------------------------
# 그누보드7 코어(app/app, config, bootstrap, resources/js/core, resources/views)는
# `core:update`/이미지 빌드에서 업스트림 순정으로 덮어쓸 수 있다.
# Moabom 운영에 꼭 필요한 Cloud Run/GCS/SaaS 부트 delta와 upstream-hook 후보만
# 단일 overlay 패치(moabom-core.patch)로 보관하고, 빌드/업데이트 단계에서 적용한다.
#
# 사용:
#   bash deploy/core-patches/apply-core-patches.sh           # 적용
#   bash deploy/core-patches/apply-core-patches.sh --check    # 적용 가능 여부만 확인
#
# 멱등: 이미 적용돼 있으면 건너뛴다. 충돌 시 --3way 로 표식만 남기고 실패 반환.
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/../../app" && pwd)"
PATCH="${SCRIPT_DIR}/moabom-core.patch"
# shellcheck source=../lib/g7-worktree.sh
source "${ROOT}/deploy/lib/g7-worktree.sh"

CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

log() { printf '[core-patches] %s\n' "$*"; }

[[ -f "${PATCH}" ]] || { log "ERROR: 패치 파일 없음: ${PATCH}"; exit 1; }
g7_git_setup "${APP_DIR}"

# 1) 이미 적용돼 있는가? (reverse-check 통과 = 현재 트리에 patch 내용이 존재)
if g7_git apply --check --reverse "${PATCH}" >/dev/null 2>&1; then
  log "이미 적용됨 — 건너뜀 (reverse-check 통과)."
  exit 0
fi

# 2) pristine 코어에 깨끗하게 적용 가능한가?
if g7_git apply --check "${PATCH}" >/dev/null 2>&1; then
  if [[ "${CHECK_ONLY}" == "1" ]]; then
    log "OK: 깨끗하게 적용 가능 (--check)."
    exit 0
  fi
  g7_git apply "${PATCH}"
  log "OK: 코어 패치 적용 완료 ($(grep -c '^diff --git' "${PATCH}")개 파일)."
  exit 0
fi

# 3) 컨텍스트 불일치(코어가 새 버전으로 올라간 경우) — 3way 시도
log "WARN: clean apply 실패 — 코어 버전 변경 가능성. --3way 시도."
if [[ "${CHECK_ONLY}" == "1" ]]; then
  log "ERROR: --check 모드에서 clean apply 불가. 수동 검토 필요."
  exit 2
fi
if g7_git apply --3way "${PATCH}"; then
  log "OK: 3way 병합으로 적용 완료 (충돌 없음)."
  exit 0
fi

log "ERROR: 충돌 발생 — 수동 해결 필요. 충돌 표식이 코어 파일에 남았다."
log "       해결 후 패치 재생성: deploy/core-patches/regenerate.sh 참고."
exit 3
