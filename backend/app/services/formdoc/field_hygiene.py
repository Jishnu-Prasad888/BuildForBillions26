"""Which detected fields the citizen should ever see: office-only fields and duplicates are dropped."""
from __future__ import annotations

import logging
import re

log = logging.getLogger("forms.hygiene")

OFFICE_USE = re.compile(r"office\s*use|for\s+(the\s+)?bank('?s)?\s+use|bank\s+use\s+only|for\s+office|official\s+use|"
                        r"to\s+be\s+filled\s+(in\s+)?by\s+(the\s+)?(bank|branch|office|officer|official)|for\s+departmental\s+use", re.I)


def is_office_only(field: dict) -> bool:
    return bool(OFFICE_USE.search(f"{field.get('label', '')} {field.get('description', '')}"))


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def _same_box(a: list[float], b: list[float], tol: float = 2.0) -> bool:
    return len(a) == 4 and len(b) == 4 and all(abs(x - y) <= tol for x, y in zip(a, b))


def clean_fields(fields: list[dict]) -> list[dict]:
    """Drop office-use fields and fields that repeat another's label and box on the same page. Order is kept."""
    kept: list[dict] = []
    for f in fields:
        if is_office_only(f):
            log.info("Hiding office-use field on page %s", f.get("page"))
            continue
        if any(k["page"] == f["page"] and _norm(k["label"]) == _norm(f["label"]) and _same_box(k["bbox"], f["bbox"]) for k in kept):
            log.info("Hiding duplicate field on page %s", f.get("page"))
            continue
        kept.append(f)
    return kept
