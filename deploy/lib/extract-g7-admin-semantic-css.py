#!/usr/bin/env python3
"""Extract G7 sirsoft-admin_basic semantic CSS body from main.css.

Scope matches Moabom g7-semantic.css contract:
  - comment banner "UI System - Semantic Classes" (or @layer components)
  - full @layer components { ... }
  - MEDIA QUERIES block through EOF (includes sidebar-scrollbar)

Used by deploy/sync-g7-admin-semantic-css.sh
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


HEADER = """\
/**
 * G7 sirsoft-admin_basic UI System — Semantic Classes (upstream SSOT)
 * Source: templates/_bundled/sirsoft-admin_basic/src/styles/main.css
 * Upstream: https://github.com/gnuboard/g7
 * Synced-by: deploy/sync-g7-admin-semantic-css.sh
 * Moabom keeps this file byte-faithful to G7; local extras live in components.css.
 */
"""


def extract_semantic_body(main_text: str) -> str:
    lines = main_text.splitlines()
    start = None
    for i, line in enumerate(lines):
        if line.strip() == "@layer components {":
            start = i
            break
    if start is None:
        raise ValueError("sirsoft-admin_basic main.css: @layer components { not found")

    header_start = start
    for j in range(start - 1, max(-1, start - 12), -1):
        if "UI System - Semantic" in lines[j] or lines[j].startswith("/* ==="):
            for k in range(j, max(-1, j - 6), -1):
                if lines[k].startswith("/* ==="):
                    header_start = k
                    break
            break

    depth = 0
    end_layer = None
    for i in range(start, len(lines)):
        depth += lines[i].count("{") - lines[i].count("}")
        if i > start and depth == 0:
            end_layer = i
            break
    if end_layer is None:
        raise ValueError("sirsoft-admin_basic main.css: @layer components block unclosed")

    rest = lines[end_layer + 1 :]
    mq_idx = None
    for i, line in enumerate(rest):
        if "MEDIA QUERIES" in line:
            mq_idx = i
            for k in range(i, max(-1, i - 5), -1):
                if rest[k].startswith("/* ==="):
                    mq_idx = k
                    break
            break

    body_lines = lines[header_start : end_layer + 1]
    if mq_idx is not None:
        body_lines = body_lines + [""] + rest[mq_idx:]
    else:
        body_lines = body_lines + rest

    return "\n".join(body_lines).rstrip() + "\n"


def strip_moabom_header(text: str) -> str:
    """Remove leading Moabom sync banner if present; return body only."""
    s = text.lstrip("\ufeff")
    if s.startswith("/**"):
        end = s.find("*/")
        if end != -1:
            rest = s[end + 2 :]
            return rest.lstrip("\n")
    return s


def build_synced_file(main_text: str) -> str:
    return HEADER + "\n" + extract_semantic_body(main_text)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("main_css", type=Path, help="Path to G7 sirsoft-admin_basic main.css")
    parser.add_argument(
        "--body-only",
        action="store_true",
        help="Print extracted body without Moabom header (for hash compare)",
    )
    parser.add_argument("-o", "--output", type=Path, help="Write synced file instead of stdout")
    args = parser.parse_args()

    main_text = args.main_css.read_text(encoding="utf-8")
    if args.body_only:
        out = extract_semantic_body(main_text)
    else:
        out = build_synced_file(main_text)

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(out, encoding="utf-8")
    else:
        sys.stdout.write(out)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001 — CLI surface
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
