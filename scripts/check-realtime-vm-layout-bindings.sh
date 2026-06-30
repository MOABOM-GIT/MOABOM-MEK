#!/usr/bin/env bash
# admin_realtime_vm layout JSON — computed/UI 바인딩·미등록 컴포넌트 재발 방지
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LAYOUT="${ROOT}/app/modules/moabom-system/resources/layouts/admin/admin_realtime_vm.json"

fail() { echo "FAIL: $*" >&2; exit 1; }

[[ -f "${LAYOUT}" ]] || fail "missing ${LAYOUT}"

python3 - "${LAYOUT}" <<'PY'
import json, re, sys

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    layout = json.load(f)

version = str(layout.get("version", "0"))
parts = [int(x) for x in version.split(".") if x.isdigit()]
while len(parts) < 3:
    parts.append(0)
if tuple(parts) < (1, 0, 4):
    sys.exit(f"version {version} < 1.0.4 (DB sync 전 구형 바인딩 패턴)")

computed = set(layout.get("computed", {}).keys())
text = json.dumps(layout, ensure_ascii=False)

refs = set(re.findall(r"_computed\.([a-zA-Z0-9_]+)", text))
missing = sorted(refs - computed)
if missing:
    sys.exit(f"_computed refs without computed def: {missing}")

legacy = {"wsProbe", "runtimeConfig", "vmMetricsData"}
if legacy & computed:
    sys.exit(f"legacy object computed keys still present: {sorted(legacy & computed)}")

required = {
    "wsHttpStatus", "clientEndpoint", "procNginx", "archVm", "vmMetricsAvailable"
}
if not required <= computed:
    sys.exit(f"missing required scalar computed keys: {sorted(required - computed)}")

for name in ("Dl", "Dt", "Dd"):
    if f'"name": "{name}"' in text:
        sys.exit(f"forbidden component {name} (not in moabom-admin_basic)")

def walk(node):
    if isinstance(node, dict):
        it = node.get("iteration")
        if isinstance(it, dict) and "data" in it and "source" not in it:
            sys.exit("iteration.data without iteration.source (engine ignores data key)")
        for v in node.values():
            walk(v)
    elif isinstance(node, list):
        for item in node:
            walk(item)

walk(layout)
print(f"OK: admin_realtime_vm v{version} — computed/UI bindings valid")
PY
