"""Turn router: decides what a message typed or spoken during form filling *is* before anything is saved.

Classify first, then act: a message only becomes a field value when the router says it is an answer.

Rules come first and handle English, Hindi, Kannada and Hinglish, including voice-style text with fillers. When the rules
can't tell and an LLM is available, it is asked for the *intent only*, on redacted text. Values are always extracted by
code: citizen-entered values are never sent to an LLM (see the privacy notes in ``assistant.py``).
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass

log = logging.getLogger("forms.router")

INTENTS = ("answer", "question", "skip", "dont_know", "correction", "not_applicable", "other")


@dataclass
class Turn:
    intent: str
    value: str | None = None
    target_field: str | None = None
    confidence: float = 1.0
    reason: str = ""


# ----------------------------------------------------------------------------------------------- normalisation
# Standalone filler words dropped from the start/end of a message (never from the middle of a value).
_FILLERS = {
    "um", "umm", "ummm", "uh", "uhh", "uhm", "hmm", "hm", "er", "erm", "ah", "haan", "han", "haa", "ha", "toh", "bhai",
    "bhaai", "bhaiya", "bhaiyya", "yaar", "matlab", "basically", "so", "well", "arey", "arre", "acha", "achha", "accha",
    "ok", "okay", "ji", "sir", "madam", "please", "pls", "plz",
}
_TRAILING = {"hai", "hain", "h", "he", "ji", "sir", "madam", "only", "please", "pls", "thanks", "thank", "you", "hoon",
             "hun", "hu", "ho", "aahe", "ide", "ಇದೆ", "है", "हैं", "हूँ", "हूं", "जी"}


def _words(s: str) -> list[str]:
    return s.split()


def _dedupe_repeats(s: str) -> str:
    """"my my name is is Nithin" -> "my name is Nithin" (speech recognisers repeat words)."""
    out: list[str] = []
    for w in _words(s):
        if out and out[-1].lower() == w.lower():
            continue
        out.append(w)
    return " ".join(out)


def clean(text: str) -> str:
    """Trim fillers at the edges and repeated words. Keeps the original casing of the rest."""
    s = re.sub(r"\s+", " ", (text or "").strip())
    s = _dedupe_repeats(s)
    ws = _words(s)
    while ws and re.sub(r"[^\w]", "", ws[0].lower()) in _FILLERS and len(ws) > 1:
        ws.pop(0)
    while ws and re.sub(r"[^\w]", "", ws[-1].lower()) in _FILLERS and len(ws) > 1:
        ws.pop()
    return " ".join(ws).strip(" ,")


def _low(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower()).strip()


# ----------------------------------------------------------------------------------------------- vocabularies
_SKIP = re.compile(
    r"^(please\s+)?(skip(\s+(it|this|this one|this field|for now))?|chhodo|chodo|chhod do|chod do|chhodiye|baad (mein|me|main)|"
    r"later|next|not now|pass|abhi nahi|abhi nahin|aage badho|aage chalo|mundhe|ಮುಂದೆ|ಬಿಡಿ|छोड़ो|छोड़ दो|बाद में|अगला)"
    r"(\s+(please|pls|for now|karo|kijiye))?[\s.!]*$", re.I)

_DONT_KNOW = re.compile(
    r"\b(i\s*(do\s*not|don'?t|dont)\s*know|don'?t know|dont know|no idea|not sure|i'?m not sure|no clue|"
    r"pata\s*nahi+n?|nahi+n?\s*pata|pata\s*nahi\s*hai|maloom\s*nahi+n?|malum\s*nahi+n?|nahi+n?\s*maloom|nahi+n?\s*malum|"
    r"gottilla|gotilla|nanage gottilla)\b|पता नहीं|नहीं पता|मालूम नहीं|नहीं मालूम|ಗೊತ್ತಿಲ್ಲ|ಗೊತ್ತು ಇಲ್ಲ", re.I)

# Question words. English ones count at the start ("what is…") or after "i/we" ("how do i…"); Hinglish, Hindi and
# Kannada ones count anywhere, because those languages put them later in the sentence.
_Q_EN_START = re.compile(r"^(what|where|which|how|why|who|whom|whose|when|do (i|we|you)|does|did (i|you)|is it|is this|is there|are (there|these|you)|"
                         r"can (i|we|you|u)|could (i|we|you)|should (i|we)|would (i|we|you)|explain|tell me|meaning of|"
                         r"what's|whats|how's)\b", re.I)
_Q_EN_ANY = re.compile(r"\b(how (do|can|should|will) (i|we)|what (is|are|does|do|should)|which (one|option)|"
                       r"can i|should i|do i need|what does .* mean|mean(s|ing)? of|meaning)\b", re.I)
_Q_INDIC = re.compile(
    r"\b(kaise|kaisa|kaisi|kya|kyaa|kyun|kyon|kyu|kaun|kaunsa|kaunsi|kaunse|kitna|kitni|kitne|kahan|kahaan|kab|kidhar|"
    r"batao|bataiye|bataye|bata do|samjhao|samjhaiye|matlab kya|yaavudu|yavudu|hege|yake|eshtu)\b|"
    r"क्या|कैसे|कैसा|कैसी|क्यों|कौन|कौनसा|कितना|कितने|कहाँ|कहां|कब|बताओ|बताइए|समझाओ|"
    r"ಏನು|ಹೇಗೆ|ಯಾಕೆ|ಯಾರು|ಎಷ್ಟು|ಎಲ್ಲಿ|ಯಾವ|ಹೇಳಿ", re.I)

_OTHER = re.compile(r"^(hi|hello|hey|namaste|namaskar|namaskara|thanks|thank you|thankyou|thx|ok|okay|okk|hmm+|fine|"
                    r"good|great|nice|shukriya|dhanyavad|dhanyavaad|dhanyawad|bye|wait|one (sec|second|minute)|ruko|"
                    r"नमस्ते|धन्यवाद|ठीक है|ನಮಸ್ಕಾರ|ಧನ್ಯವಾದ)[\s.!]*$", re.I)

_CORRECTION_LEAD = re.compile(r"^(actually|sorry|no[,]?|nahi[,]?|galti se|galti ho gayi|mistake|correction|oops|"
                              r"wait[,]?|change|update|correct)\b[\s,:-]*", re.I)

# A statement that *describes the world* instead of answering the question: "I don't have a PAN", "I am
# unmarried", "there is no spouse". It is deliberately separate from "I don't know" (the answer is unknown),
# and it never carries a value — a denial must never be written into a field. Answering it is the assistant's
# job (``answers.denial``), so this router only refuses to treat it as an answer.
_DENIAL = re.compile(
    r"\b(i\s*(do\s*not|don'?t|dont|does\s*not|doesn'?t)\s+have|"
    r"i\s*(do\s*not|don'?t|dont)\s+own|"
    r"there\s*('?s|is)\s+no|have\s+no|has\s+no|"
    r"i\s*(am|are|was)\s+not|"
    r"i\s*(am|are)\s+(un\w+|no\b|without|not)|none\s+of\s+(them|these|the\s+above)|neither|"
    r"not\s+applicable|does\s+not\s+apply|"
    r"no\s+(one|father|mother|spouse|husband|wife|pan|aadhaar|job|income|salary|address|phone|email|guardian))\b", re.I)

# "my name is X", "mera naam X hai", "it is X", "X hai" …
_LEAD_PHRASES = [
    r"(my|mera|meri|mere|our|hamara|hamari|the|its|it's|it is|this is|that is|that's|yeh|ye|woh|wo|nanna|namma|"
    r"मेरा|मेरी|मेरे|हमारा|यह|ನನ್ನ|ನಮ್ಮ)\s+",
    r"(i am|i'm|im|main|mai|mein|naan|nanu|मैं|ನಾನು)\s+",
]
_CONNECTOR = r"(?:\s+(?:is|are|was|hai|hain|h|he|will be|should be|would be|ಇದೆ|है)|\s*[:=\-])\s+"


def _strip_trailing(s: str) -> str:
    ws = _words(s)
    while len(ws) > 1 and re.sub(r"[^\wऀ-෿]", "", ws[-1].lower()) in _TRAILING:
        ws.pop()
    return " ".join(ws).strip(" ,.;")


def _label_words(label: str) -> list[str]:
    stop = {"of", "the", "a", "an", "your", "applicant", "applicants", "and", "or", "no", "number", "details", "name"}
    ws = [w for w in re.sub(r"[^a-z0-9 ]+", " ", label.lower()).split() if w]
    keep = [w for w in ws if w not in stop]
    return keep or ws


def _label_prefix(label: str) -> str:
    """Regex matching how people refer to a field when answering: "branch", "account number", "name", "naam"…"""
    ws = [re.escape(w) for w in re.sub(r"[^a-z0-9 ]+", " ", label.lower()).split() if w]
    alts = {" ".join(ws)} if ws else set()
    alts.update(re.escape(w) for w in _label_words(label))
    if re.search(r"\bname\b", label, re.I):
        alts.update({"name", "naam", "nam", "hesaru", "नाम", "ಹೆಸರು"})
    if re.search(r"account", label, re.I):
        alts.update({"account number", "account no", "a/c number", "a/c no", "account", "khata number", "khata"})
    if re.search(r"mobile|phone", label, re.I):
        alts.update({"mobile number", "phone number", "mobile", "phone", "number"})
    return "(" + "|".join(sorted((a for a in alts if a), key=len, reverse=True)) + ")"


def extract_value(text: str, label: str) -> tuple[str, float]:
    """The value alone, from a message that answers ``label``. Returns (value, confidence)."""
    s = clean(text)
    original = s
    lp = _label_prefix(label)
    patterns = [
        # "my name is Nithin", "mera naam Ravi hai", "the branch is Jayanagar"
        rf"^(?:{_LEAD_PHRASES[0]})?{lp}{_CONNECTOR}(?P<v>.+)$",
        # "branch Jayanagar hai", "naam Ravi hai", "account number 1234"
        rf"^(?:{_LEAD_PHRASES[0]})?{lp}\s+(?P<v>.+)$",
        # "it is Jayanagar", "this is Ravi"
        rf"^(?:it is|it's|its|this is|that is|that's|yeh|ye|woh|wo)\s+(?P<v>.+)$",
        # "I am Nithin", "main Nithin hoon"
        rf"^(?:{_LEAD_PHRASES[1]})(?P<v>.+)$",
    ]
    for i, p in enumerate(patterns):
        if i == 3 and not re.search(r"\bname\b", label, re.I):
            continue  # "I am …" only introduces a name
        m = re.match(p, s, re.I)
        if m and m.group("v").strip():
            v = _strip_trailing(m.group("v").strip())
            if v:
                return v, 0.9
    v = _strip_trailing(original)
    n = len(_words(v))
    return v, (0.95 if n <= 5 else 0.8 if n <= 8 else 0.6)


def _mentioned_field(text: str, fields: list[dict], exclude: str | None) -> dict | None:
    """A field the message names explicitly ("actually my branch is …"), longest label match wins."""
    low = _low(clean(text))
    best, best_len = None, 0
    for f in fields:
        if f["field_id"] == exclude:
            continue
        lab = re.sub(r"[^a-z0-9 ]+", " ", f["label"].lower()).strip()
        if len(lab) < 3:
            continue
        if re.search(rf"(^|\b(my|mera|meri|the|change|update)\s+){re.escape(lab)}\b", low) and len(lab) > best_len:
            best, best_len = f, len(lab)
    return best


def is_question(text: str) -> bool:
    s = clean(text)
    return bool("?" in s or _Q_EN_START.search(s) or _Q_EN_ANY.search(s) or _Q_INDIC.search(s))


#: Schema type or detector type: both vocabularies are accepted so a row written before the schema switch
#: still routes the same way.
_CHOICE_TYPES = ("select", "radio", "yes_no", "choice")


def _is_choice(field: dict) -> bool:
    return (field.get("type") in _CHOICE_TYPES) or (field.get("input_type") == "choice")


def route(text: str, field: dict | None, fields: list[dict], *, option_match=None, llm=None) -> Turn:
    """Classify one message sent while ``field`` is being asked.

    ``option_match(field, text) -> list[str]`` resolves choice answers ("2", "new card"). ``llm(redacted_text, field)``
    may return one of INTENTS when the rules are unsure; it never supplies a value.
    """
    raw = (text or "").strip()
    s = clean(raw)
    if not s:
        return Turn("other", confidence=1.0, reason="empty")
    if _SKIP.match(s):
        return Turn("skip", reason="skip word")
    if _DONT_KNOW.search(s):
        return Turn("dont_know", reason="dont-know phrase")
    if _DENIAL.search(s) and not re.match(r"^\s*(yes|no|nope|nahi|nahin)\b", s, re.I):
        # "not applicable" / "leave blank" are explicit instructions about the *box*, not values.
        return Turn("not_applicable", reason="denial: the citizen says they do not have this")

    # Corrections: "actually my branch is Koramangala" (another field) or "sorry, it's Ravi" (this field).
    lead = _CORRECTION_LEAD.match(s)
    if lead and not is_question(s):
        rest = s[lead.end():]
        target = _mentioned_field(rest, fields, None) or field
        if target is not None and rest.strip():
            v, conf = extract_value(rest, target["label"])
            if v:
                return Turn("correction", v, target["field_id"], min(conf, 0.9), "correction lead")

    if field is not None and _is_choice(field) and option_match and "?" not in s:
        m = option_match(field, s)
        if len(m) == 1 or (m and field.get("meta", {}).get("multiple")):
            return Turn("answer", s, field["field_id"], 0.95, "option match")

    if is_question(s):
        return Turn("question", reason="question marker")
    if _OTHER.match(s):
        return Turn("other", reason="small talk")

    # Naming another field explicitly while this one is asked: "branch Jayanagar hai" when "To" is displayed. Needs a
    # connector ("… is …", "… hai"), so a value that merely starts with a label ("Branch Road, Jayanagar") stays put.
    other = _mentioned_field(s, fields, field["field_id"] if field else None)
    explicit = re.search(r"(^|\s)(is|are|was|hai|hain|will be|should be|है|ಇದೆ)(\s|$)|\s*[:=]\s*", s, re.I)
    if other is not None and field is not None and explicit:
        v, conf = extract_value(s, other["label"])
        if v and _low(v) != _low(s):
            return Turn("correction", v, other["field_id"], min(conf, 0.85), "names another field")

    if field is None:
        return Turn("other", reason="no field being asked")
    value, conf = extract_value(s, field["label"])
    if not value:
        return Turn("other", reason="nothing left after cleaning")

    # Long free text for a short field: let the LLM (if any) double-check the intent. Values stay with the code.
    if conf < 0.7 and llm is not None:
        try:
            intent = llm(s, field)
        except Exception as exc:  # noqa: BLE001
            log.info("Router LLM unavailable: %s", type(exc).__name__)
            intent = None
        if intent in ("question", "skip", "dont_know", "other"):
            return Turn(intent, confidence=0.75, reason="llm intent")
    return Turn("answer", value, field["field_id"], conf, "rules")


# ----------------------------------------------------------------------------------------------- optional LLM check
_LLM_SYSTEM = (
    "You classify ONE message a citizen sent while filling a government form. The current field is given. Users write "
    "English, Hindi, Kannada or mixed (Hinglish). Reply with JSON only: {\"intent\": \"answer|question|skip|dont_know|other\"}. "
    "Any question, even without '?', is question. 'pata nahi', 'i don't know' -> dont_know. 'skip', 'baad mein' -> skip. "
    "A message that gives information for the field is answer.\n"
    "Examples: 'my name is Nithin' -> answer. 'Bhaai mujhe account number kaisa janana padega' -> question. "
    "'pata nahi' -> dont_know. 'baad mein' -> skip. 'thanks' -> other."
)


def llm_intent(redacted_text: str, field: dict) -> str | None:
    """Intent from the configured LLM, or None when no LLM is reachable. Only the redacted message and the field label
    are sent."""
    from app.services.ai import get_ai

    ai = get_ai()
    if not ai.llm_available():
        return None
    out = ai.generate_json([
        {"role": "system", "content": _LLM_SYSTEM},
        {"role": "user", "content": f"Field: {field['label']} ({field['type']})\nMessage: {redacted_text}"},
    ])
    intent = (out or {}).get("intent")
    return intent if intent in INTENTS else None
