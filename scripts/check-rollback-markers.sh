#!/usr/bin/env bash
# 롤백 의도 vs git HEAD·워킹트리 마커 점검 (owner-button 재적용 등 재발 방지)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

fail=0
warn=0

check_absent() {
  local label="$1"
  local pattern="$2"
  local path="$3"
  if grep -qE "$pattern" "$path" 2>/dev/null; then
    echo -e "${RED}FAIL${NC} $label — 발견: $path"
    grep -nE "$pattern" "$path" | head -3
    fail=$((fail + 1))
  else
    echo -e "${GREEN}OK${NC}   $label"
  fi
}

check_present() {
  local label="$1"
  local pattern="$2"
  local path="$3"
  if grep -qE "$pattern" "$path" 2>/dev/null; then
    echo -e "${GREEN}OK${NC}   $label"
  else
    echo -e "${RED}FAIL${NC} $label — 없음: $path"
    fail=$((fail + 1))
  fi
}

echo "=== 롤백 마커 (워킹트리) ==="

CSS_VIEWER="app/templates/moabom-basic/src/styles/moa-home/29-generated-app-viewer.css"
SHELL_ROOT="app/templates/moabom-basic/src/styles/moa-home/03-shell-root.css"
GEN_VIEWER="app/templates/moabom-basic/src/apps/generated/GeneratedAppViewer.tsx"
NAV="app/templates/moabom-basic/src/data/Moa_navigation.ts"

check_absent "owner-button liquid-glass ::before 오버레이" \
  'generated-app-owner-button\.liquid-glass::before' "$CSS_VIEWER"
check_absent "owner-button 이중 box-shadow(28%)" \
  'rgb\(15 23 42 / 28%\)' "$CSS_VIEWER"
check_absent "moa-generated-app-viewer CSS/TSX" \
  'moa-generated-app-viewer' \
  "app/templates/moabom-basic/src"
check_absent "viewport :has(generated-app-viewer)" \
  ':has\(\.moa-generated-app-viewer\)' "$CSS_VIEWER"
check_absent "이중 iframe buildWebsiteLinkAppHtml" \
  'buildWebsiteLinkAppHtml' "app/templates/moabom-basic"

check_present "단일 iframe resolveGeneratedAppFrameUrl" \
  'resolveGeneratedAppFrameUrl' "$GEN_VIEWER"
check_present "GeneratedAppViewer h-full flex 체인" \
  'h-full min-h-0 flex-1' "$GEN_VIEWER"
check_present "하단 NAV 4개(즐겨찾기 탭 없음)" \
  "id: 'notice'" "$NAV"

if grep -qE '\.moa-app-window-viewport \{[^}]*display:\s*flex' "$SHELL_ROOT" 2>/dev/null; then
  echo -e "${RED}FAIL${NC} viewport display:flex — 전역 flex 롤백 전 상태"
  fail=$((fail + 1))
else
  echo -e "${GREEN}OK${NC}   viewport display:flex 없음 (컨설팅 레이아웃 롤백)"
fi

echo ""
echo "=== git HEAD vs 워킹트리 (재적용 위험) ==="

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git diff --quiet HEAD -- "$CSS_VIEWER" 2>/dev/null; then
    echo -e "${GREEN}OK${NC}   $CSS_VIEWER — HEAD와 동일"
  else
    echo -e "${YELLOW}WARN${NC} $CSS_VIEWER — HEAD와 다름 (롤백이 커밋 안 됨)"
    warn=$((warn + 1))
    if git show "HEAD:$CSS_VIEWER" 2>/dev/null | grep -qE 'liquid-glass::before|28%'; then
      echo "       HEAD에는 강화(glass) 버전이 남아 있음 → 커밋 전 배포 시 워킹트리 기준"
    fi
  fi

  uncommitted=$(git diff --name-only HEAD 2>/dev/null | wc -l)
  untracked=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l)
  total=$((uncommitted + untracked))
  if [[ "$total" -gt 0 ]]; then
    echo -e "${YELLOW}WARN${NC} 미커밋 변경 ${uncommitted}개 + 미추적 ${untracked}개"
    echo "       Cloud Build는 업로드 tarball 기준이라 운영≠git HEAD 일 수 있음"
    warn=$((warn + 1))
  else
    echo -e "${GREEN}OK${NC}   git 워킹트리 깨끗함"
  fi
else
  echo -e "${YELLOW}WARN${NC} git 저장소 아님 — HEAD 비교 생략"
  warn=$((warn + 1))
fi

echo ""
if [[ "$fail" -gt 0 ]]; then
  echo -e "${RED}롤백 마커 실패 ${fail}건${NC}"
  exit 1
fi
if [[ "$warn" -gt 0 ]]; then
  echo -e "${YELLOW}경고 ${warn}건 — 배포 전 커밋·diff 확인 권장${NC}"
  exit 0
fi
echo -e "${GREEN}롤백 마커 전부 통과${NC}"
