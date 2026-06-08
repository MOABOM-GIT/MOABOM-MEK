#!/usr/bin/env bash
# afterAgentResponse: observe-only — 금지 행위/안내 패턴 로그
set -euo pipefail

input=$(cat)
text=$(echo "$input" | python3 -c "import json,sys; print(json.load(sys.stdin).get('text') or '')" 2>/dev/null || true)

if [[ -z "$text" ]]; then
  exit 0
fi

violations=()

check() {
  local label="$1"
  local pattern="$2"
  if echo "$text" | grep -qiE "$pattern"; then
    violations+=("$label")
  fi
}

check 'WSL/호스트 빌드 안내' '(WSL|호스트).{0,40}(빌드|npm|rebuild|dist 재)'
check 'rebuild 스크립트 안내' 'rebuild-moabom-basic-dist|rebuild[[:space:]]*스크립트'
check 'npm build 안내' 'npm (run build|ci)'
check 'update --force' 'template:update|module:update|--force'
check '_bundled 작업' '_bundled.{0,30}(작업|수정|빌드|미러)'
check '미러링' '미러(링)?|mirroring'
check '롤백' '롤백|rollback|revert'
check '사용자 떠넘기기' '(확인|반영).{0,20}(하려면|필요|실행)'
check 'git 이력 뒤지기' 'git[[:space:]]+(log|show|blame|grep|reflog|bisect|whatchanged|shortlog|rev-list|rev-parse)'
check 'GitHub 뒤지기' 'gh[[:space:]]+(pr|issue|search|run|api[[:space:]]+repos|browse)'
# 🔴 로컬 빌드/배포/도커 언급 (몇 달째 반복 위반 — 절대 금지)
check '로컬 빌드 언급' '로컬([[:space:]]|에서)*[[:space:]]*빌드|local[[:space:]]+build'
check '로컬 배포 언급' '로컬[[:space:]]*배포|local[[:space:]]+deploy'
check '로컬 도커 언급' '로컬[[:space:]]*도커|local[[:space:]]+docker|docker[[:space:]]+(build|push)'
check 'dist 재빌드 언급' 'dist[[:space:]]*재[[:space:]]*빌드|rebuild[[:space:]]+dist'
check 'WSL 빌드 언급' '(WSL|호스트)[[:space:]]*에서[[:space:]]*(빌드|npm|build)'

if ((${#violations[@]} > 0)); then
  # dedupe
  mapfile -t unique < <(printf '%s\n' "${violations[@]}" | sort -u)
  joined=$(IFS=', '; echo "${unique[*]}")
  echo "[moabom-user-workflow] 금지 행위/안내 패턴 감지 (observe-only): ${joined}" >&2
fi

exit 0
