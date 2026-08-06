#!/usr/bin/env bash
# Network boot architecture — post-deploy CSV checklist
#
# Usage (after Cloud Build/Run deploy):
#   bash deploy/check-network-boot-csv-hints.sh path/to.csv
#
# Static gates (no deploy):
#   deploy/check-moabom-refactor-invariants.sh
#   deploy/check-before-cloud-build.sh

set -euo pipefail

CSV="${1:-}"
if [[ -z "${CSV}" || ! -f "${CSV}" ]]; then
  echo "Usage: $0 <network-export.csv>"
  echo "Success criteria:"
  echo "  - components.iife.js / components.css TTFB <100ms (nginx static)"
  echo "  - config.json / home.json memory-patched or fast"
  echo "  - unread-count / settings at most once on boot"
  echo "  - HTML document wait short on revisit (SW NetworkFirst 0.4s → stale HTML paint)"
  echo "  - shell-boot revisit: SW StaleWhileRevalidate cache response (no origin RTT wait)"
  echo "  - weather/auth must not sit at 15s 504 (client timeout ~8s)"
  echo "  - DO NOT disable login notification/inbox WS for perf (product contract)"
  exit 1
fi

echo "== network-boot CSV hints: ${CSV} =="

python3 - "$CSV" <<'PY'
import csv, sys, re
from collections import Counter

path = sys.argv[1]

def parse_duration(cell: str):
    if not cell:
        return None
    s = cell.replace("\xa0", " ").replace(",", "").strip()
    if "캐시" in s or "cache" in s.lower() or "대기" in s:
        return 0.0
    # Require explicit time unit to avoid mistaking icon-512.png etc.
    m = re.search(r"([\d]+(?:\.[\d]+)?)\s*(초|ms)\b", s, re.I)
    if not m:
        m = re.search(r"([\d]+(?:\.[\d]+)?)\s*s\b", s, re.I)
        if not m:
            return None
        val = float(m.group(1))
        return val
    val = float(m.group(1))
    unit = m.group(2).lower()
    return val / 1000.0 if unit == "ms" else val

rows = []
statuses = []
with open(path, newline="", encoding="utf-8-sig") as f:
    for row in csv.reader(f):
        if not row:
            continue
        name = (row[0] or "").strip()
        if not name or name.startswith("요청") or name.startswith("완료") or name.startswith("DOM") or name.startswith("로드"):
            continue
        status = (row[1] or "").strip() if len(row) > 1 else ""
        dur = parse_duration(row[-1]) if row else None
        rows.append((name, dur))
        statuses.append((name, status, dur))

counts = Counter(n for n, _ in rows)
interesting = ("unread-count", "settings", "summary", "online", "library", "heartbeat", "config.json", "shell-boot", "credits", "weather", "auth")

print("-- duplicate interesting names --")
shown = False
for n, c in sorted(counts.items(), key=lambda x: -x[1]):
    if c <= 1:
        continue
    if any(k in n for k in interesting):
        print(f"  {c}x  {n}")
        shown = True
if not shown:
    print("  (none)")

print("-- gateway timeouts (504 / >=14s) --")
bad = [
    (n, st, d) for n, st, d in statuses
    if st == "504" or (d is not None and d >= 14.0)
]
for n, st, d in bad[:20]:
    print(f"  status={st or '?'}  {d}s  {n}")
if not bad:
    print("  (none)")

print("-- slow rows (>=0.8s) top 25 --")
slow = [(n, d) for n, d in rows if d is not None and d >= 0.8]
slow.sort(key=lambda x: -x[1])
for n, d in slow[:25]:
    print(f"  {d:.2f}s  {n}")
if not slow:
    print("  (none)")

print("-- static asset candidates --")
for needle in ("components.iife.js", "components.css", "bundle.js", "components.json"):
    hits = [(n, d) for n, d in rows if needle in n]
    if not hits:
        print(f"  {needle}: not found")
        continue
    for n, d in hits[:3]:
        if d is None:
            flag = "?"
        elif d < 0.15:
            flag = "OK"
        else:
            flag = "SLOW"
        print(f"  [{flag}] {d}  {n}")
PY
