#!/usr/bin/env bash
# beforeShellExecution: Moabom 금지 셸 명령 하드 차단
set -euo pipefail

input=$(cat)
command=$(echo "$input" | python3 -c "import json,sys; print(json.load(sys.stdin).get('command') or '')" 2>/dev/null || true)

if [[ -z "$command" ]]; then
  echo '{"permission":"allow"}'
  exit 0
fi

deny() {
  python3 -c "import json,sys; print(json.dumps({'permission':'deny','user_message':'에이전트가 실행할 수 없는 Moabom 금지 명령입니다.','agent_message':sys.argv[1]}))" "$1"
  exit 0
}

# _bundled 경로 작업 (읽기 전용 rg/cat/grep/ls/find/git diff/status/log 은 허용)
if echo "$command" | grep -q '_bundled'; then
  if echo "$command" | grep -qE '(^|[[:space:]|;])(cp|mv|rsync|sed -i|tee |>|>>|npm |php artisan (template|module):(update|build)|MOABOM_ALLOW_LOCAL)'; then
    deny "Moabom: _bundled 는 구버전 미러입니다. 편집·빌드·복사·update 금지. 활성 app/modules·app/templates 만 수정하세요."
  fi
  if echo "$command" | grep -qE 'sync-moabom-system-from-bundled|template:update|module:update'; then
    deny "Moabom: _bundled·update --force·미러 스크립트 금지 (롤백 사고 원인)."
  fi
fi

# update / mirror (경로 무관)
if echo "$command" | grep -qE 'template:update|module:update|sync-moabom-system-from-bundled'; then
  deny "Moabom: template:update / module:update / bundled→활성 sync 금지. 활성 디렉터리에 직접 수정만."
fi

# template:build / module:build without --active
if echo "$command" | grep -qE 'template:build|module:build'; then
  if ! echo "$command" | grep -q '\--active'; then
    deny "Moabom: template:build / module:build 는 --active 없이 금지 (_bundled 덮어쓰기)."
  fi
fi

# 호스트/WSL 에서 활성 템플릿/모듈 직접 빌드 금지 — 모든 빌드는 Cloud Build 안에서
# (사용자 정책 SSOT: _bundled 는 구버전 미러라 호스트 빌드 의미 없고, 활성도 호스트 npm 폴백 사고[RF-20] 방지)
if echo "$command" | grep -qE 'rebuild-moabom-basic-dist|MOABOM_ALLOW_LOCAL_BUILD'; then
  deny "Moabom: 호스트/WSL dist 빌드 우회 금지. src 만 수정하고 ./deploy/build-and-deploy.sh 실행 — Cloud Build 가 dist 까지 만든다."
fi

if echo "$command" | grep -qE '(templates/moabom-(basic|admin_basic)|modules/moabom-system).*npm (run build|ci)|cd[^;]*moabom-(basic|admin_basic|system)[^;]*npm (run build|ci)'; then
  deny "Moabom: 활성 템플릿/모듈의 호스트 npm build/ci 금지 (RF-20). Cloud Build 가 Dockerfile assets 스테이지에서 일괄 빌드함."
fi

# Local docker image build/push for Run
if echo "$command" | grep -qE 'docker (build|push).*deploy/Dockerfile|asia-northeast3-docker\.pkg\.dev'; then
  deny "Moabom: Run 이미지는 Cloud Build(build-and-deploy.sh) 만. 로컬 docker build/push 금지."
fi

# 🛑 Moabom: 에이전트의 "history hunting / GitHub 뒤지기" 차단
#   허용: git pull/fetch/push/clone/status/add/commit/branch/checkout/merge/rebase/remote/tag/stash 등 정상 워크플로
#   차단: 사용자 질문에 답하려고 반사적으로 git log·show·blame·grep·diff(과거 ref) 로 이력 뒤지기
#         + gh repo/pr/issue/search 같은 GitHub 메타데이터 뒤지기
#   원칙: 코드/변경 사실 확인은 Grep/Glob/Read 로 현재 워킹트리에서. 이력은 사용자가 명시 요청할 때만.

# 1) 이력 검색 계열 git 서브커맨드 차단
if echo "$command" | grep -qE '(^|[[:space:];|&(])git[[:space:]]+(log|show|blame|grep|reflog|bisect|cherry|whatchanged|shortlog|rev-list|rev-parse)([[:space:]]|$)'; then
  deny "Moabom: 에이전트의 git 이력 뒤지기 금지 (log/show/blame/grep/reflog/bisect/whatchanged/shortlog/rev-list/rev-parse). 코드 조사는 Grep/Glob/Read 로 현재 워킹트리에서 수행. 이력 조회는 사용자가 명시 요청할 때만."
fi

# 2) git log/diff 의 pickaxe·history 검색 옵션 차단
if echo "$command" | grep -qE '(^|[[:space:];|&(])git[[:space:]]+[a-z-]+([[:space:]]+(--all|--since|--until|--author|--committer|--grep=|-S[[:space:]"'\'']|-G[[:space:]"'\''])|[[:space:]]+--pretty)'; then
  deny "Moabom: git --all/--since/--until/--author/--grep=/-S/-G 등 이력 검색 옵션 금지. Grep/Glob/Read 로 워킹트리만 조사."
fi

# 3) git diff 가 과거 ref 를 비교 (HEAD~, HEAD^, 브랜치, SHA, ..) — 워킹트리 diff 는 허용
if echo "$command" | grep -qE '(^|[[:space:];|&(])git[[:space:]]+diff[[:space:]]+([^-][^[:space:]]*\.\.|HEAD[~^]|[0-9a-f]{7,40}([[:space:]]|$))'; then
  deny "Moabom: 과거 ref 비교 (git diff HEAD~ / SHA / a..b) 금지. 워킹트리 변경 확인은 git diff (인자 없음) 또는 IDE diff 로."
fi

# 4) GitHub CLI 로 PR/이슈/검색 뒤지기 차단 (auth/repo clone 같은 워크플로는 허용)
if echo "$command" | grep -qE '(^|[[:space:];|&(])gh[[:space:]]+(pr|issue|search|run|api[[:space:]]+repos|browse)([[:space:]]|$)'; then
  deny "Moabom: gh pr/issue/search/run/api repos/browse 로 GitHub 뒤지기 금지. 사용자가 PR·이슈를 명시 요청할 때만."
fi

# 5) 파괴적 git (기존 정책 유지)
if echo "$command" | grep -qE 'git[[:space:]]+(reset[[:space:]]+--hard|revert|checkout[[:space:]]+.*[[:space:]]--([[:space:]]|$)|restore[[:space:]])'; then
  deny "Moabom: git rollback/revert/restore 는 사용자가 명시 요청할 때만."
fi

echo '{"permission":"allow"}'
exit 0
