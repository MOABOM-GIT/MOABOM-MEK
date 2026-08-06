#!/usr/bin/env bash
# Admin settings layout JSON ↔ defaults.json ↔ module lang 바인딩 정합
# (필드 누락·저장 body 카테고리 누락·관련 $t 미번역으로 구형 UI/저장 실패 재발 방지)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "== check-module-settings-layout-bindings =="

python3 - "${ROOT}" <<'PY'
import json
import re
import sys
from pathlib import Path

root = Path(sys.argv[1])
modules = root / "app" / "modules"
errors: list[str] = []
checked = 0


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def expand_lang_partials(data: object, lang_dir: Path, stack: set[str] | None = None) -> object:
    """resources/lang 의 `$partial` 참조를 인라인으로 펼친다."""
    stack = stack or set()
    if isinstance(data, dict):
        if set(data.keys()) == {"$partial"} and isinstance(data["$partial"], str):
            rel = data["$partial"]
            if not rel.endswith(".json"):
                rel = f"{rel}.json"
            target = (lang_dir / rel).resolve()
            key = str(target)
            if key in stack:
                return {}
            if not target.is_file():
                return {"__missing_partial__": rel}
            stack.add(key)
            nested = load_json(target)
            return expand_lang_partials(nested, lang_dir, stack)
        return {k: expand_lang_partials(v, lang_dir, stack) for k, v in data.items()}
    if isinstance(data, list):
        return [expand_lang_partials(v, lang_dir, stack) for v in data]
    return data


def resolve_t(lang: dict, key: str) -> bool:
    # $t:moabom-credit.admin.settings.sections.ai_spend
    if not key.startswith("$t:"):
        return True
    parts = key[3:].split(".")
    if not parts:
        return False
    cur: object = lang
    start = 1 if parts[0].startswith(("moabom-", "sirsoft-")) else 0
    for p in parts[start:]:
        if not isinstance(cur, dict) or p not in cur:
            return False
        cur = cur[p]
    if isinstance(cur, dict) and "__missing_partial__" in cur:
        return False
    return not isinstance(cur, dict)


for module_dir in sorted(modules.iterdir()):
    if not module_dir.is_dir():
        continue
    defaults_path = module_dir / "config" / "settings" / "defaults.json"
    if not defaults_path.is_file():
        continue
    layouts_dir = module_dir / "resources" / "layouts" / "admin"
    if not layouts_dir.is_dir():
        continue

    try:
        defaults = load_json(defaults_path)
    except json.JSONDecodeError as e:
        errors.append(f"{module_dir.name}: defaults.json invalid JSON ({e})")
        continue

    categories = list(defaults.get("_meta", {}).get("categories") or [])
    default_values = defaults.get("defaults") or {}
    if not categories:
        continue

    lang_dir = module_dir / "resources" / "lang"
    ko_path = lang_dir / "ko.json"
    en_path = lang_dir / "en.json"
    ko = expand_lang_partials(load_json(ko_path), lang_dir) if ko_path.is_file() else {}
    en = expand_lang_partials(load_json(en_path), lang_dir) if en_path.is_file() else {}

    cat_alt = "|".join(map(re.escape, categories))
    name_re = re.compile(rf'"name"\s*:\s*"((?:{cat_alt})\.[^"]+)"')

    for layout_path in sorted(layouts_dir.glob("*.json")):
        if layout_path.name.startswith("_"):
            continue
        try:
            layout = load_json(layout_path)
        except json.JSONDecodeError as e:
            errors.append(f"{module_dir.name}/{layout_path.name}: invalid JSON ({e})")
            continue

        text = layout_path.read_text(encoding="utf-8")
        if "_local.form" not in text:
            continue
        # settings 저장 API 를 쓰는 레이아웃만
        if not re.search(r"/admin/settings|/settings\"", text):
            continue

        checked += 1
        layout_name = layout.get("layout_name") or layout_path.stem
        if not layout.get("version"):
            errors.append(f"{module_dir.name}/{layout_name}: layout version 누락")

        names = sorted(set(name_re.findall(text)))
        if not names:
            # form 기반이지만 category.field Input 이 없으면 스킵(다른 패턴)
            continue

        for full in names:
            cat, _, rest = full.partition(".")
            if cat not in default_values:
                errors.append(f"{module_dir.name}/{layout_name}: layout field `{full}` — defaults 카테고리 없음")
                continue
            top = rest.split(".", 1)[0]
            if top not in default_values[cat]:
                errors.append(
                    f"{module_dir.name}/{layout_name}: layout field `{full}` — defaults.{cat}.{top} 없음"
                )

        used_cats = sorted({n.split(".", 1)[0] for n in names})
        for cat in used_cats:
            if f"_local.form?.{cat}" not in text and f"_local.form.{cat}" not in text:
                errors.append(
                    f"{module_dir.name}/{layout_name}: PUT body에 `{cat}: _local.form?.{cat}` 바인딩 없음"
                )

        # i18n: sections/fields/hints 키만 강제 (partial 펼친 뒤)
        tkeys = sorted(set(re.findall(r"\$t:([a-zA-Z0-9_.-]+)", text)))
        prefix = module_dir.name + "."
        for key in tkeys:
            if not key.startswith(prefix):
                continue
            if not any(seg in key for seg in (".sections.", ".fields.", ".hints.")):
                continue
            full = f"$t:{key}"
            if ko_path.is_file() and not resolve_t(ko, full):
                errors.append(f"{module_dir.name}/{layout_name}: ko.json 누락 `{key}`")
            if en_path.is_file() and not resolve_t(en, full):
                errors.append(f"{module_dir.name}/{layout_name}: en.json 누락 `{key}`")

if checked == 0:
    print("WARN: no settings layouts checked")
else:
    print(f"checked {checked} settings layout(s)")

if errors:
    for e in errors:
        print(f"GAP: {e}", file=sys.stderr)
    sys.exit(1)

print("OK: settings layout ↔ defaults ↔ lang bindings")
PY

echo "== check-module-settings-layout-bindings PASSED =="
