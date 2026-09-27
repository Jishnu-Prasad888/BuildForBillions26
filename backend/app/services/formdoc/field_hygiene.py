"""Which detected fields the citizen should ever see: office-only fields and duplicates are dropped."""
from __future__ import annotations

import logging
import re

log = logging.getLogger("forms.hygiene")

OFFICE_USE = re.compile(r"office\s*use|for\s+(the\s+)?bank('?s)?\s+use|bank\s+use\s+only|for\s+office|official\s+use|"
                        r"to\s+be\s+filled\s+(in\s+)?by\s+(the\s+)?(bank|branch|office|officer|official)|for\s+departmental\s+use", re.I)


#: A field printed *inside* an office-use section is for the official, not for the citizen, even when the
#: label itself is innocent ("Date", "Signature of the Authorised Signatory" under "FOR OFFICE USE ONLY").
OFFICE_SECTION = re.compile(r"office\s*use|for\s+(the\s+)?(bank|office|branch|official)s?\b|official\s+use|"
                            r"to\s+be\s+filled\s+(in\s+)?by\s+(the\s+)?(bank|branch|office|officer|official)|"
                            r"for\s+departmental\s+use|bank\s+use\s+only|internal\s+use", re.I)


def is_office_only(field: dict) -> bool:
    """Is this field for the official to fill in, rather than for the citizen?

    Two independent signals, either of which is enough: the field says so itself ("for bank use only"), or
    the section it is printed in does. The section is what saves the KYC form, where a bare "Date" sits
    under "FOR OFFICE USE ONLY" with no wording of its own.
    """
    if OFFICE_USE.search(f"{field.get('label', '')} {field.get('description', '')}"):
        return True
    return bool(OFFICE_SECTION.search(field.get("section", "") or ""))


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
