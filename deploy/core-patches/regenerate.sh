#!/usr/bin/env bash
#
# moabom-core.patch 재생성 스크립트
# ---------------------------------------------------------------------------
# 현재 g7 app 워킹 트리의 코어 delta(HEAD 대비)를 moabom-core.patch 로 다시 떠낸다.
# - 의도적으로 코어 패치를 추가/수정했을 때
# - core:update 후 --3way 충돌을 수동 해결한 뒤
# 실행한다.
#
# 포함 경로: app/ config/ bootstrap/ routes/ database/migrations/
#            resources/js/core/ resources/views/ tests/
# 제외: 순수 파일 모드(권한) 변경, moabom 확장(modules/plugins/templates/lang-packs)
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/../../app" && pwd)"
PATCH="${SCRIPT_DIR}/moabom-core.patch"
# shellcheck source=../lib/g7-worktree.sh
source "${ROOT}/deploy/lib/g7-worktree.sh"

g7_git_setup "${APP_DIR}"

CORE_PATHS=(app config bootstrap routes database/migrations resources/js/core resources/views tests)

# 내용이 실제로 바뀐 tracked 파일만 (numstat added+deleted > 0 → 모드 전용 변경 제외)
mapfile -t TRACKED < <(g7_git diff HEAD --numstat -- "${CORE_PATHS[@]}" | awk '($1+$2)>0 {print $3}')
# 신규(untracked) 코어 파일
mapfile -t UNTRACKED < <(g7_git ls-files --others --exclude-standard -- "${CORE_PATHS[@]}")

if [[ ${#TRACKED[@]} -eq 0 && ${#UNTRACKED[@]} -eq 0 ]]; then
  echo "[regenerate] 코어 변경 없음 — 패치 미생성."
  exit 0
fi

# 신규 파일을 패치에 new-file 형태로 담기 위해 intent-to-add
if [[ ${#UNTRACKED[@]} -gt 0 ]]; then
  g7_git add -N -- "${UNTRACKED[@]}"
fi

g7_git diff HEAD -- "${TRACKED[@]}" "${UNTRACKED[@]}" > "${PATCH}"

# intent-to-add 원복 (untracked 상태로 복귀)
if [[ ${#UNTRACKED[@]} -gt 0 ]]; then
  g7_git reset -q -- "${UNTRACKED[@]}"
fi

echo "[regenerate] 생성: ${PATCH}"
echo "[regenerate] 파일 수: $(grep -c '^diff --git' "${PATCH}")  (tracked ${#TRACKED[@]} + untracked ${#UNTRACKED[@]})"
echo "[regenerate] 검증: git apply --check --reverse 로 정합성 확인 권장."
