#!/usr/bin/env bash
# Moabom responsive breakpoint guard.
# Keep layout breakpoints on the shared px scale; ordinary spacing/sizing values are out of scope.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

FAIL=0

fail() {
  echo "ERROR: $*"
  FAIL=1
}

ok() {
  echo "    OK: $*"
}

ALLOWED_PX='480|640|768|1000|1024|1280|1400'

TARGETS=(
  "app/templates/moabom-basic/src/styles"
  "app/templates/moabom-basic/src/apps/appWindowBreakpoints.ts"
  "app/templates/moabom-basic/src/pages/home/moaHomeConstants.ts"
  "app/templates/moabom-admin_basic/src/styles"
  "app/modules/moabom-system/js/admin"
)

existing_targets=()
for target in "${TARGETS[@]}"; do
  [[ -e "${target}" ]] && existing_targets+=("${target}")
done

echo "==> responsive breakpoints: allowed px = ${ALLOWED_PX//|/, }"

if bad_units="$(
  grep -RInE '(@media|@container|--breakpoint-|--moa-cq-|BREAKPOINT_|MOA_APP_WINDOW_CQ).*[0-9]+(\.[0-9]+)?(rem|em)' "${existing_targets[@]}" 2>/dev/null || true
)"; [[ -n "${bad_units}" ]]; then
  echo "${bad_units}"
  fail "breakpoint 조건에 rem/em 사용 금지 — 허용 px 값만 사용"
fi

if bad_px="$(
  grep -RInE '(@media|@container|--breakpoint-|--moa-cq-|BREAKPOINT_|MOA_APP_WINDOW_CQ).*([0-9]+)px' "${existing_targets[@]}" 2>/dev/null \
    | grep -Ev "(${ALLOWED_PX})px" || true
)"; [[ -n "${bad_px}" ]]; then
  echo "${bad_px}"
  fail "허용 목록 밖 breakpoint px 사용"
fi

if boundary_hacks="$(
  grep -RInE '(@media|@container).*(479|639|767|1023|1279)px|(@media|@container).*[0-9]+\.[0-9]+(px|rem|em)' "${existing_targets[@]}" 2>/dev/null || true
)"; [[ -n "${boundary_hacks}" ]]; then
  echo "${boundary_hacks}"
  fail "경계 회피값 금지 — CSS range 문법(width < 640px 등) 사용"
fi

if [[ "${FAIL}" -ne 0 ]]; then
  exit 1
fi

ok "responsive breakpoints are on the shared scale"
