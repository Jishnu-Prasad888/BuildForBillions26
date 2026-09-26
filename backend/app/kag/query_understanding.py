"""Step 1-2 of KAG: understand the question (language, life event, intent, schemes)."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.graph import get_graph
from app.ingestion.pipeline import detect_scheme_mentions
from app.kag.lang import detect_language
from app.services.ai import get_ai

# Small multilingual glossary used for query expansion when no LLM is available.
GLOSSARY = {
    "आधार": "aadhaar", "बैंक": "bank account", "खाता": "account", "दस्तावेज़": "documents", "दस्तावेज": "documents",
    "कागज": "documents", "पात्र": "eligible eligibility", "पात्रता": "eligibility", "बीमा": "insurance pmfby",
    "ऋण": "loan", "कर्ज": "loan", "आवेदन": "apply application", "कितना": "amount", "पैसा": "amount money",
    "सर्वे": "survey number", "ज़मीन": "land record", "जमीन": "land record", "किसान": "farmer", "सम्मान निधि": "pm-kisan",
    "ಆಧಾರ್": "aadhaar", "ಬ್ಯಾಂಕ್": "bank account", "ಖಾತೆ": "account", "ದಾಖಲೆ": "documents", "ದಾಖಲೆಗಳು": "documents",
    "ಅರ್ಹತೆ": "eligibility", "ವಿಮೆ": "insurance pmfby", "ಸಾಲ": "loan", "ಅರ್ಜಿ": "apply application", "ಎಷ್ಟು": "amount",
    "ಹಣ": "amount money", "ಸರ್ವೆ": "survey number", "ಪಹಣಿ": "rtc pahani land record", "ಜಮೀನು": "land record", "ರೈತ": "farmer",
}

INTENT_PATTERNS = {
    "why": r"why did you|why do you say|where did you get|source of (this|that)|क्यों बताया|ಯಾಕೆ ಹೇಳಿದ",
    "documents": r"document|papers|proof|certificate|दस्तावेज|कागज|प्रमाण|ದಾಖಲೆ|ಪುರಾವೆ",
    "eligibility": r"eligib|qualify|can i get|am i|who can|पात्र|योग्य|ಅರ್ಹ",
    "how_to_apply": r"how (do|can|to) .*apply|apply|process|procedure|steps|register|आवेदन|कैसे|ಅರ್ಜಿ|ಹೇಗೆ",
    "amount": r"how much|amount|money|benefit|rupees|₹|कितना|राशि|ಎಷ್ಟು|ಮೊತ್ತ",
}


DISCOVER_PATTERN = (r"what help|any help|help me|can i get|what can i do|scheme|support|assistance|relief|compensation|"
                    r"मदद|सहायता|योजना|राहत|ಸಹಾಯ|ನೆರವು|ಯೋಜನೆ|ಪರಿಹಾರ")


@dataclass
class QueryContext:
    question: str
    language: str
    retrieval_query: str
    life_event: dict | None = None
    intent: str = "general"
    scheme_codes: list[str] = field(default_factory=list)
    state: str | None = None
    translated: bool = False

    def as_dict(self) -> dict:
        return {
            "language": self.language, "retrieval_query": self.retrieval_query, "intent": self.intent,
            "life_event": {"code": self.life_event["code"], "name": self.life_event["name"],
                           "context": self.life_event.get("context")} if self.life_event else None,
            "scheme_codes": self.scheme_codes, "state": self.state, "translated": self.translated,
        }


def _detect_life_event(text: str) -> dict | None:
    lower = text.lower()
    best, best_hits = None, 0
    for le in get_graph().life_events():
        hits = 0
        for lang_words in (le.get("keywords") or {}).values():
            for w in lang_words:
                if re.search(r"[a-z]", w):
                    hits += bool(re.search(r"\b" + re.escape(w.lower()) + r"\b", lower))
                else:
                    hits += w in text
        if hits > best_hits:
            best, best_hits = le, hits
    # require at least 2 signals (e.g. "crop" + "rain") to avoid false positives
    return best if best_hits >= 2 else None


def _translate_for_retrieval(text: str) -> str | None:
    out = get_ai().generate([
        {"role": "system", "content": "Translate the user's text to plain English for a search engine. Output only the translation."},
        {"role": "user", "content": text},
    ])
    return out.strip() if out else None


def understand(question: str, language_hint: str | None = None, context_schemes: list[str] | None = None,
               state: str | None = None) -> QueryContext:
    lang = detect_language(question, language_hint or "en")
    retrieval_query, translated = question, False
    if lang != "en":
        tr = _translate_for_retrieval(question)
        if tr:
            retrieval_query, translated = f"{tr}", True
        else:
            extra = [en for native, en in GLOSSARY.items() if native in question]
            retrieval_query = question + " " + " ".join(extra)
    life_event = _detect_life_event(question + " " + retrieval_query)
    if life_event and lang != "en" and not translated:
        retrieval_query += " " + life_event["name"] + " " + " ".join(life_event["keywords"].get("en", [])[:8])

    probe = (question + " " + retrieval_query).lower()
    # "discover" = the citizen describes a situation and asks broadly for help
    broad = bool(re.search(DISCOVER_PATTERN, probe)) or not re.search(r"\?|\b(how|when|what|which|where|why|who)\b", probe)
    intent = "discover" if (life_event and broad) else "general"
    for name, pat in INTENT_PATTERNS.items():
        if re.search(pat, probe):
            # "what help can I get" after describing a life event is still discovery
            if not (life_event and name in ("eligibility", "amount")):
                intent = name
            break
    schemes = detect_scheme_mentions(retrieval_query) or detect_scheme_mentions(question)
    if not schemes and context_schemes:
        schemes = list(context_schemes)
    return QueryContext(question=question, language=lang, retrieval_query=retrieval_query, life_event=life_event,
                        intent=intent, scheme_codes=schemes, state=state, translated=translated)
