"""BLOCK LETTERS: many forms say "Please fill this form in BLOCK LETTERS". Detection and the one place text is uppercased."""
from __future__ import annotations

import re
from collections.abc import Iterable

_ASKS = re.compile(r"\bblock\s+(?:letters|capitals)\b|\bcapital\s+letters\b|\bin\s+capitals\b", re.I)
# Values that stay as they are: an email address in capitals is a different (wrong) address to a human reader.
_KEEP_CASE = {"email"}


def asks_for_block_letters(page_texts: Iterable[str]) -> bool:
    """True when any page of the form itself asks for block letters."""
    return any(_ASKS.search(t or "") for t in page_texts)


def apply_block_letters(field_type: str, text: str) -> str:
    """Uppercase what is written on the form. Hindi/Kannada have no case, so they pass through unchanged."""
    return text if field_type in _KEEP_CASE else text.upper()
