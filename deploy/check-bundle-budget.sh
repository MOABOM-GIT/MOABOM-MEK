#!/usr/bin/env bash
# 번들 예산 가드 — dist 셸 청크가 상한(KB)을 넘으면 배포 전 차단.
#
# 배경: 외부 UI 라이브러리/의존성 도입 시 청크가 조용히 비대해져 초기 로드가 느려진다.
#       앱이 수십 개로 늘 때 이 가드가 회귀를 자동으로 잡는다.
#
# 정책:
#  - 파일별 상한은 "현재 크기 + 여유". 의도적 증가면 이 파일에서 상한을 올린다(리뷰 흔적).
#  - 신규 셸 청크(moabom-shell-*.iife.js)는 DEFAULT_BUDGET_KB 적용.
#  - raw 바이트 기준(커밋본과 일치, 결정적). gzip 이 아니라 과대측정이지만 가드 목적엔 충분.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_ROOT="${MOABOM_APP_ROOT:-${ROOT}/app}"
JS_DIR="${APP_ROOT}/templates/moabom-basic/dist/js"

DEFAULT_BUDGET_KB=200
FAIL=0

# 파일별 상한(KB). 현재(2026-07): components≈719, cpap≈174, consulting≈41, create-app≈503(CodeMirror), gallery≈56.
budget_for() {
  case "$1" in
    components.iife.js)               echo 735 ;;  # 메인 셸 — 버전/데이터콘솔/셸브릿지·order dirty·chrome SSOT
    moabom-shell-cpap-mask.iife.js)   echo 280 ;;  # @mediapipe/tasks-vision 포함(무거움)
    moabom-shell-consulting.iife.js)  echo 140 ;;
    moabom-shell-create-app.iife.js)  echo 560 ;;  # CodeMirror 6 HTML 에디터 (직접 입력·생성 후 편집)
    image-gallery-lightbox.iife.js)   echo 160 ;;
    *)                                echo "${DEFAULT_BUDGET_KB}" ;;
  esac
}

if [ ! -d "${JS_DIR}" ]; then
  echo "ERROR: dist js 디렉토리 없음: ${JS_DIR} (먼저 dist 재빌드)"
  exit 1
fi

shopt -s nullglob
found=0
for f in "${JS_DIR}"/*.iife.js; do
  found=1
  name="$(basename "$f")"
  bytes="$(wc -c < "$f")"
  kb=$(( (bytes + 1023) / 1024 ))
  budget="$(budget_for "$name")"
  if [ "${kb}" -gt "${budget}" ]; then
    echo "ERROR: ${name} ${kb}KB > 예산 ${budget}KB — 번들 비대화. 코드분할/의존성 점검 또는 상한 상향(deploy/check-bundle-budget.sh)"
    FAIL=1
  else
    echo "    OK: ${name} ${kb}KB / ${budget}KB"
  fi
done

if [ "${found}" -eq 0 ]; then
  echo "ERROR: ${JS_DIR} 에 *.iife.js 청크 없음 (dist 재빌드 필요)"
  exit 1
fi

exit "${FAIL}"
