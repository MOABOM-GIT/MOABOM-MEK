#!/usr/bin/env bash
# Sync / check G7 sirsoft-admin_basic main.css → moabom-admin_basic g7-semantic.css
#
# Why: 운영 활성 admin SSOT 는 moabom-admin_basic. G7 #408 시맨틱 자산은
#      sirsoft-admin_basic main.css 에 정의되므로, 업스트림 admin CSS 변경 시
#      g7-semantic.css 를 별도 동기화해야 한다.
#
# Usage:
#   bash deploy/sync-g7-admin-semantic-css.sh           # write (동기화)
#   bash deploy/sync-g7-admin-semantic-css.sh --check   # drift 있으면 exit 1
#   bash deploy/sync-g7-admin-semantic-css.sh --check --allow-missing-upstream
#       # upstream main.css 를 못 찾으면 SKIP(0) — Cloud Build 등
#
# Source resolution (first hit):
#   1) $G7_ADMIN_MAIN_CSS
#   2) app/templates/_bundled/sirsoft-admin_basic/src/styles/main.css
#   3) g7_git show HEAD:templates/_bundled/sirsoft-admin_basic/src/styles/main.css
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${ROOT}/app"
EXTRACTOR="${ROOT}/deploy/lib/extract-g7-admin-semantic-css.py"
TARGET="${APP}/templates/moabom-admin_basic/src/styles/ui-system/g7-semantic.css"
BUNDLED_MAIN="${APP}/templates/_bundled/sirsoft-admin_basic/src/styles/main.css"
UPSTREAM_BLOB='templates/_bundled/sirsoft-admin_basic/src/styles/main.css'

MODE=write
ALLOW_MISSING=0

for arg in "$@"; do
  case "${arg}" in
    --check) MODE=check ;;
    --write) MODE=write ;;
    --allow-missing-upstream) ALLOW_MISSING=1 ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "ERROR: unknown arg: ${arg}" >&2
      exit 2
      ;;
  esac
done

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "OK:   $*"; }
skip() { echo "SKIP: $*"; exit 0; }

[[ -f "${EXTRACTOR}" ]] || fail "extractor 없음: ${EXTRACTOR}"
[[ -f "${TARGET}" ]] || fail "target 없음: ${TARGET}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT
SRC_MAIN="${TMP_DIR}/main.css"
SRC_LABEL=""

resolve_source() {
  if [[ -n "${G7_ADMIN_MAIN_CSS:-}" ]]; then
    [[ -f "${G7_ADMIN_MAIN_CSS}" ]] || fail "G7_ADMIN_MAIN_CSS 파일 없음: ${G7_ADMIN_MAIN_CSS}"
    cp "${G7_ADMIN_MAIN_CSS}" "${SRC_MAIN}"
    SRC_LABEL="env:G7_ADMIN_MAIN_CSS"
    return 0
  fi
  if [[ -f "${BUNDLED_MAIN}" ]]; then
    cp "${BUNDLED_MAIN}" "${SRC_MAIN}"
    SRC_LABEL="working-tree:_bundled/sirsoft-admin_basic"
    return 0
  fi
  # shellcheck source=lib/g7-worktree.sh
  source "${ROOT}/deploy/lib/g7-worktree.sh"
  if g7_git_setup "${APP}" 2>/dev/null; then
    if g7_git cat-file -e "HEAD:${UPSTREAM_BLOB}" 2>/dev/null; then
      g7_git show "HEAD:${UPSTREAM_BLOB}" > "${SRC_MAIN}"
      SRC_LABEL="g7-git:HEAD:${UPSTREAM_BLOB}"
      return 0
    fi
  fi
  return 1
}

if ! resolve_source; then
  if [[ "${ALLOW_MISSING}" -eq 1 ]]; then
    skip "upstream sirsoft-admin_basic main.css 없음 (parity check 생략)"
  fi
  fail "upstream main.css 를 찾을 수 없음 — _bundled 경로 또는 app/.git.g7-upstream-backup 필요"
fi

REQUIRED=(
  admin-page-content
  admin-page-content-responsive
  admin-page-content-viewport
  admin-card
  flex-between
  sticky-tab-nav-responsive
)
for cls in "${REQUIRED[@]}"; do
  grep -qE "\\.${cls}[[:space:]]*\\{" "${SRC_MAIN}" \
    || fail "upstream main.css 에 .${cls} 정의 없음 (손상/구버전?): ${SRC_LABEL}"
done

EXPECTED="${TMP_DIR}/expected-g7-semantic.css"
EXPECTED_BODY="${TMP_DIR}/expected-body.css"
CURRENT_BODY="${TMP_DIR}/current-body.css"

python3 "${EXTRACTOR}" "${SRC_MAIN}" -o "${EXPECTED}"
python3 "${EXTRACTOR}" "${SRC_MAIN}" --body-only -o "${EXPECTED_BODY}"
python3 - <<PY
from pathlib import Path
import importlib.util
spec = importlib.util.spec_from_file_location("ext", "${EXTRACTOR}")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
body = mod.strip_moabom_header(Path("${TARGET}").read_text(encoding="utf-8"))
Path("${CURRENT_BODY}").write_text(body, encoding="utf-8")
PY

echo "== sync-g7-admin-semantic-css (${MODE}) =="
echo "    source: ${SRC_LABEL}"
echo "    target: templates/moabom-admin_basic/src/styles/ui-system/g7-semantic.css"

if cmp -s "${EXPECTED_BODY}" "${CURRENT_BODY}"; then
  ok "g7-semantic.css 가 upstream main.css 시맨틱 구간과 일치"
  exit 0
fi

if [[ "${MODE}" == "check" ]]; then
  echo "FAIL: g7-semantic.css 가 upstream 과 불일치" >&2
  echo "      동기화: bash deploy/sync-g7-admin-semantic-css.sh" >&2
  if command -v diff >/dev/null 2>&1; then
    diff -u "${CURRENT_BODY}" "${EXPECTED_BODY}" | head -n 80 >&2 || true
  fi
  exit 1
fi

cp "${EXPECTED}" "${TARGET}"
ok "g7-semantic.css ← upstream 시맨틱 구간 동기화 완료"
echo "NOTE: template version/CHANGELOG 갱신이 필요하면 moabom-admin_basic 에서 별도 반영"
exit 0
