"""Query normalizer: clean voice/Hinglish input and build an English expansion query.

Run on every message before retrieval.  The user's original wording is always
kept as `question`; the English expansion goes only into `extra_query`.

NOT a replacement for the KAG pipeline - only changes what goes *into* it.
"""
from __future__ import annotations

import logging
import re

from sqlalchemy.orm import Session

from app.kag import agent
from app.kag.lang import detect_language

log = logging.getLogger("normalizer")

# ---------------------------------------------------------------------------
# Speech-recognition misspellings and letter-by-letter spellings.
# These are ASR artefacts and spoken Hinglish words that GLOSSARY in
# query_understanding.py does NOT cover.  Check GLOSSARY before adding here.
# ---------------------------------------------------------------------------
ASR_VARIANTS: dict[str, str] = {
    # Scheme names spoken letter-by-letter
    r"\bk[\s.-]*c[\s.-]*c\b": "KCC",
    r"\bp[\s.-]*m[\s.-]*f[\s.-]*b[\s.-]*y\b": "PMFBY",
    r"\bk[\s.-]*y[\s.-]*c\b": "KYC",
    r"\bn[\s.-]*e[\s.-]*f[\s.-]*t\b": "NEFT",
    r"\br[\s.-]*t[\s.-]*g[\s.-]*s\b": "RTGS",
    r"\bi[\s.-]*f[\s.-]*s[\s.-]*c\b": "IFSC",
    r"\bi[\s.-]*f[\s.-]*c[\s.-]*code\b": "IFSC",
    r"\bp[\s.-]*m[\s.-]*k[\s.-]*i[\s.-]*s[\s.-]*a[\s.-]*n\b": "PM-KISAN",
    # Common mis-spellings / mis-recognitions
    r"\bkisaan\b": "Kisan",
    r"\bkissan\b": "Kisan",
    r"\bkredit\b": "credit",
    r"\bkard\b": "card",
    r"\bpasbook\b": "passbook",
    r"\bifcs\b": "IFSC",
    r"\bifc\s+code\b": "IFSC",
    r"\baccont\b": "account",
    r"\baccount\s+no\b": "account number",
    r"\bacct\b": "account",
    r"\baadhar\b": "Aadhaar",
    r"\badhaar\b": "Aadhaar",
    r"\badhar\b": "Aadhaar",
    r"\bpan\s+card\b": "PAN card",
    r"\bpan\s+no\b": "PAN number",
}

# Hinglish words / romanised Hindi not already in GLOSSARY.
HINGLISH_TERMS: dict[str, str] = {
    r"\bkaise\b": "how",
    r"\bkya\b": "what",
    r"\bkaunse\b": "which",
    r"\bkaunsa\b": "which",
    r"\bkaun\b": "who",
    r"\bkab\b": "when",
    r"\bkahan\b": "where",
    r"\bkitna\b": "how much",
    r"\bkitne\b": "how many",
    r"\bchhiye\b": "need",
    r"\bchhahiye\b": "need",
    r"\bchaiye\b": "need",
    r"\bchahiye\b": "need",
    r"\bkarte\b": "do",
    r"\bkarna\b": "do",
    r"\bkeliye\b": "for",
    r"\bke liye\b": "for",
    r"\bkeliyhe\b": "for",
    r"\bkyu\b": "why",
    r"\bkyun\b": "why",
    r"\bkyon\b": "why",
    r"\bmaafi\b": "exemption",
    r"\bfaayda\b": "benefit",
    r"\bfayda\b": "benefit",
    r"\bsarkari\b": "government",
    r"\bsahayata\b": "assistance help",
    r"\byojana\b": "scheme",
    r"\byojna\b": "scheme",
    r"\blabharthi\b": "beneficiary",
    r"\bkisaan\b": "farmer",
    r"\bkhadya\b": "food",
    r"\bkhet\b": "farm field",
    r"\bfasal\b": "crop",
    r"\bpaisa\b": "money amount",
    r"\bpaise\b": "money amount",
    r"\bnuksaan\b": "loss damage",
    r"\bnuksan\b": "loss damage",
    r"\babhiyan\b": "campaign scheme",
    r"\bbima\b": "insurance",
    r"\brin\b": "loan",
    r"\bkarj\b": "loan",
    r"\bkarz\b": "loan",
    r"\bkhaata\b": "account",
    r"\bkhata\b": "account",
    r"\bdastaveez\b": "document",
    r"\bdastavej\b": "document",
    r"\bbharna\b": "fill",
    r"\bbharo\b": "fill",
    r"\bjameen\b": "land",
    r"\bjamin\b": "land",
    r"\bpehchan\b": "identity",
    r"\bpehchaan\b": "identity",
    r"\bpramaanpatra\b": "certificate",
    r"\bpramaan\b": "proof",
}

# Filler words to strip from the start/middle of an utterance.
FILLER_RE = re.compile(
    r"\b(um{1,3}|uh+|hmm+|err+|aah+|like|you know|i mean|basically|so+|okay so|right so|"
    r"actually|well|let me see|let's see)\b", re.I)

REPEAT_RE = re.compile(r"\b(\w{3,})\s+\1\b", re.I)

# Form-offer detection: user wants to fill a specific form.
_FORM_OFFER_RE = re.compile(
    r"\b(fill|filling|bharo|bharna|apply|form (ke )?liye|form\s+fill)\b.*\b(kcc|pmfby|pm.kisan|form)\b"
    r"|\b(kcc|pmfby|pm.kisan)\b.*\b(form|fill|bharo|bharna)\b"
    r"|\b(form bharna hai|form bhar\b|apply karna hai|form submit)\b",
    re.I,
)


def _strip_fillers(text: str) -> str:
    cleaned = FILLER_RE.sub(" ", text)
    cleaned = REPEAT_RE.sub(r"\1", cleaned)
    return re.sub(r"\s{2,}", " ", cleaned).strip()


def _apply_asr_variants(text: str) -> str:
    for pat, replacement in ASR_VARIANTS.items():
        text = re.sub(pat, replacement, text, flags=re.I)
    return text


def _build_expansion(text: str, language: str) -> str:
    """English terms to add to extra_query for non-English input."""
    if language == "en":
        return ""
    terms: list[str] = []
    for pat, en in HINGLISH_TERMS.items():
        if re.search(pat, text, re.I):
            terms.append(en)
    # GLOSSARY terms are handled by query_understanding.understand() already,
    # but we repeat the most domain-relevant ones for the extra_query boost.
    from app.kag.query_understanding import GLOSSARY
    for native, en in GLOSSARY.items():
        if native in text:
            terms.append(en)
    return " ".join(dict.fromkeys(terms))  # deduplicate, preserve order


def normalize(text: str) -> tuple[str, str]:
    """Return (cleaned_text, asr_fixed_text).

    cleaned_text: fillers and repeated words stripped.
    asr_fixed_text: ASR variants expanded (KCC, IFSC, etc.) on top of cleaned.
    """
    cleaned = _strip_fillers(text)
    asr_fixed = _apply_asr_variants(cleaned)
    return cleaned, asr_fixed


def is_form_offer(text: str) -> bool:
    """True when the user wants to fill a specific form (not an existing form session)."""
    return bool(_FORM_OFFER_RE.search(text))


def answer_normalized(
    db: Session,
    question: str,
    language: str,
    *,
    channel: str = "web",
    input_mode: str = "text",
    context_schemes: list[str] | None = None,
    history: str = "",
    extra_context: str = "",
    extra_query: str = "",
    state: str | None = None,
    previous_evidence: list[dict] | None = None,
    **kwargs,
) -> dict:
    """Wrapper around agent.answer() that applies normalization first.

    The user's original wording stays as `question`.
    English expansion terms go only into extra_query.
    Logs one line per turn with channel, language, input_mode, intent,
    original, normalized and expansion.  No field values can appear in
    the log: only the text the user typed (which is redacted below).
    """
    from app.services.redact import redact

    lang = language if language in ("en", "hi", "kn") else detect_language(question, "en")
    cleaned, asr_fixed = normalize(question)
    expansion = _build_expansion(asr_fixed, lang)

    # Build the combined extra_query: caller's kwarg + expansion for non-English
    combined_extra = " ".join(filter(None, [extra_query, expansion])).strip()

    form_offer = is_form_offer(asr_fixed)

    result = agent.answer(
        db, question, lang,
        channel=channel,
        context_schemes=context_schemes,
        history=history,
        extra_context=extra_context,
        extra_query=combined_extra,
        state=state,
        previous_evidence=previous_evidence,
        **kwargs,
    )

    understanding = result.get("understanding") or {}
    log.info(
        "normalized turn channel=%s lang=%s input_mode=%s intent=%s original=%r normalized=%r expansion=%r doc_ids=%s",
        channel, lang, input_mode, understanding.get("intent", "?"),
        redact(question)[:120], redact(cleaned)[:120], expansion[:80],
        [e["id"] for e in result.get("evidence", [])[:5]],
    )

    if form_offer:
        result = dict(result)
        result["form_offer"] = True

    return result
