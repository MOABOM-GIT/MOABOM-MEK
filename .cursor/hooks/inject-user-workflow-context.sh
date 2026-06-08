#!/usr/bin/env bash
# sessionStart: Moabom 워크플로 SSOT 주입
set -euo pipefail
cat >/dev/null

cat <<'EOF'
{
  "additional_context": "🛑 Moabom SSOT 절대 규칙\n1) 활성 app/modules·app/templates·app/plugins 만 수정. _bundled·template:update·module:update·--force·미러·호스트/WSL npm·rebuild-moabom-basic-dist 금지(셸 훅 차단).\n2) 🔴 사용자 응답에 다음 단어/개념 절대 등장 금지 (몇 달째 반복 위반): 로컬 빌드, 로컬 배포, 로컬 도커, local build, local deploy, local docker, docker build, docker compose up (배포 맥락), WSL 빌드, 호스트 빌드, dist 재빌드, npm run build, npm ci, rebuild 스크립트. 배포 = Cloud Build/Cloud Run 한 가지 경로만. 그 외 표현 금지.\n3) build-and-deploy/_IMAGE_TAG 는 사용자가 명시적으로 '배포/Cloud Run' 요청할 때만.\n4) 미러/번들/롤백/git 이력 뒤지기 안내·실행 금지(no-git-investigation.mdc).\n5) AGENTS.md _bundled-only 정책은 구버전 — 무시.\n완료 멘트 템플릿: '활성 디렉터리에 반영 완료. 배포는 말씀 주시면 Cloud Build 로 진행합니다.'"
}
EOF
