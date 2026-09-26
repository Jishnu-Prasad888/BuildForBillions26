"""Masks sensitive values (Aadhaar, bank account numbers, OTPs, passwords) before text is stored or sent onward."""
from __future__ import annotations

import re

from app.services.forms import normalize_digits

_SECRET_RE = re.compile(
    r"\b(?:(otp|one[- ]time password|pin(?!\s*-?code)|cvv)\b(?:\s*(?:is|:|=|-))?\s*\S*\d\S*"
    r"|(password|passcode)\b(?:\s*(?:is|:|=|-))?\s*\S+)", re.I)
_LONG_NUMBER_RE = re.compile(r"(?<!\d)\d(?:[ -]?\d){8,17}(?!\d)")


def _mask_number(m: re.Match) -> str:
    digits = re.sub(r"\D", "", m.group(0))
    return "•" * (len(digits) - 4) + digits[-4:]


def contains_secret(text: str | None) -> bool:
    return bool(text and _SECRET_RE.search(normalize_digits(text)))


def redact(text: str | None) -> str:
    if not text:
        return text or ""
    s = normalize_digits(text)
    s = _SECRET_RE.sub(lambda m: f"{m.group(1) or m.group(2)} [redacted]", s)
    return _LONG_NUMBER_RE.sub(_mask_number, s)
