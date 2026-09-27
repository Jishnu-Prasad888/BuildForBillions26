"""Plain-language help for the screen assistant.

A citizen who asks "what is a survey number?" or "where do I find my father's name?" needs a sentence a person
wrote for that field, not whatever line of a scheme guide happens to rank first. So help comes from two places,
in a fixed order of trust:

1. ``help`` on the field itself in the form definition (authored, plain language, ``data/seed/forms/*.json``);
2. a sentence from the scheme guide, only when it is clearly prose about this field. Headings, fee lines,
   lists of labels and fragments are refused, and the caller says so honestly when nothing qualifies.

Nothing here calls a model or reads anything a citizen entered.
"""
from __future__ import annotations

import re

#: Fee lines, list headings and table fragments that appear in scheme guides and are not explanations.
_JUNK = re.compile(r":-|\brs\.?\s*\d|₹|\bper\s+annum\b|\(\s*optional\s*\)\s*:|\bparticulars\s+of\b|"
                   r"\bpremium\b|\bsr\.?\s*no\b|\bs\.?\s*no\.?\s*\d|^\W|:\s*$", re.I)
#: Words that carry no meaning of their own; they must not make a sentence look "about" a field.
_GENERIC = {"name", "number", "date", "details", "code", "type", "information", "given", "true", "declare",
            "applicant", "affected", "land", "crop", "damage", "acres", "your", "the", "and", "for", "with"}
#: Prose has these; a heading or a list of field names does not.
_FUNCTION_WORDS = {"is", "are", "the", "your", "you", "must", "should", "can", "will", "to", "of", "for", "in", "on",
                   "be", "as", "by", "from", "this", "that", "which", "if", "or", "it", "has", "have"}


def content_words(text: str) -> set[str]:
    """The words of a label that identify it (no generic words), lower-cased."""
    return {w for w in re.findall(r"\w+", (text or "").lower()) if len(w) > 3 and w not in _GENERIC}


def authored_help(field: dict, lang: str = "en") -> str:
    """The help written for this field in the form definition (``helps[lang]`` if given, else ``help``)."""
    if lang != "en":
        localized = (field.get("helps") or {}).get(lang)
        if isinstance(localized, str) and localized.strip():
            return localized.strip()
    text = field.get("help")
    return text.strip() if isinstance(text, str) else ""


def is_useful_sentence(sentence: str, label_words: set[str]) -> bool:
    """Is this guide sentence a readable explanation that is really about the field?"""
    s = re.sub(r"\s+", " ", sentence or "").strip()
    words = s.split()
    if not 5 <= len(words) <= 45 or len(s) > 260:
        return False
    if _JUNK.search(s):
        return False
    lowered = {w.strip(".,;:()").lower() for w in words}
    if len(lowered & _FUNCTION_WORDS) < 2:
        return False  # "Father name, Address, Mobile Number, Date of Birth/Age" is a list, not a sentence
    caps = sum(1 for w in words if w[:1].isupper())
    if s.count(",") >= 3 and caps / len(words) > 0.5:
        return False
    return bool(label_words & content_words(s))


def pick_guide_sentences(candidates: list[str], label_words: set[str], limit: int = 1) -> list[str]:
    """The best few guide sentences that pass :func:`is_useful_sentence`, in their original order."""
    picked: list[str] = []
    for sentence in candidates:
        if is_useful_sentence(sentence, label_words):
            picked.append(re.sub(r"\s+", " ", sentence).strip())
        if len(picked) >= limit:
            break
    return picked
