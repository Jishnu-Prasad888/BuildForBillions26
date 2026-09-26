"""Detect which scheme a form belongs to, so mid-form KAG queries are scoped.

Never touches kag/ internals - only uses ingestion.pipeline.detect_scheme_mentions
which is a public utility that scans text for scheme names.
"""
from __future__ import annotations

import re

# Explicit patterns keyed to the code IDs the KAG layer uses.
# When detect_scheme_mentions returns nothing, try these heuristics.
_FILENAME_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bkcc\b|kisan\s*credit\s*card", re.I), "KCC"),
    (re.compile(r"\bpmfby\b|pradhan\s*mantri\s*fasal\s*bima", re.I), "PMFBY"),
    (re.compile(r"\bpm\s*kisan\b|samman\s*nidhi", re.I), "PM_KISAN"),
    (re.compile(r"\bpmay\b|awas\s*yojana", re.I), "PMAY"),
    (re.compile(r"\bpmsym\b|shram\s*yogi", re.I), "PM_SYM"),
]


def detect_form_scheme(form_name: str, field_labels: list[str]) -> list[str]:
    """Return scheme codes for a form, best-effort.

    Tries detect_scheme_mentions on the form name and field labels first,
    then falls back to explicit heuristics.
    """
    try:
        from app.ingestion.pipeline import detect_scheme_mentions

        # Try form name and a sample of field labels
        probe = form_name + " " + " ".join(field_labels[:20])
        codes = detect_scheme_mentions(probe)
        if codes:
            return codes
    except Exception:  # noqa: BLE001
        pass

    # Explicit heuristics — normalize separators so \b word boundaries work
    bare = form_name.rsplit(".", 1)[0]  # strip extension
    probe = re.sub(r"[_.\-/]", " ", bare).lower()
    found = []
    for pat, code in _FILENAME_PATTERNS:
        if pat.search(probe):
            found.append(code)
    return found
