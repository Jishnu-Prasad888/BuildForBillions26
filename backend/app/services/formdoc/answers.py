"""What did the citizen just say, and what should the form store?

Three separate questions, answered separately (never in one prompt):

1. ``kind``       – is this an answer, a question, a skip, "I don't know", a correction, or a statement that
                    *describes the world* rather than answering it ("I don't have a father")?
2. ``value``      – the value alone, never the sentence: "name is jishnu prsad" -> "jishnu prsad".
3. ``normalized`` – a corrected spelling or capitalisation, *offered* back to the citizen for confirmation.

Personal data is never silently rewritten: a suggestion always becomes a question, never an edit. A denial is
never a value: it becomes an interpretation the assistant can act on (leave blank, mark not applicable, or
use the other half of a compound label).
"""
from __future__ import annotations

import difflib
import re
from dataclasses import dataclass, field

# --------------------------------------------------------------------------------------------- intent vocabulary
ANSWER, QUESTION, SKIP, DONT_KNOW, CORRECTION, NOT_APPLICABLE, OTHER = (
    "answer", "question", "skip", "dont_know", "correction", "not_applicable", "other")

#: Denials. "I don't have a father", "I have no PAN", "I am unmarried", "there is no spouse".
#: Deliberately does *not* match "I don't know" (that means the answer is unknown, which is a different turn).
DENIAL_RE = re.compile(
    r"\b(i\s*(do\s*not|don'?t|dont|does\s*not|doesn'?t)\s+have|i\s*(do\s*not|don'?t|dont)\s+own|"
    r"there\s*('?s|is)\s+no|have\s+no|has\s+no|i\s*(am|are|was)\s+not|"
    r"i\s*(am|are)\s+(un\w+|no\b|without|not)|none\s+of\s+(them|these|the\s+above)|neither|"
    r"not\s+applicable|does\s+not\s+apply|no\s+(one|father|mother|spouse|husband|wife|pan|aadhaar|job|income|"
    r"salary|address|phone|email|guardian))\b", re.I)
NOT_APPLICABLE_RE = re.compile(r"\b(not\s+applicable|n/?a\b|does\s+not\s+apply|leave\s+(it|this|that)?\s*blank|"
                              r"blank\s+it|koi\s+nahi|kuch\s+nahi|applicable\s+nahi)\b", re.I)

YES_RE = re.compile(r"^\s*(yes|y|yeah|yep|correct|right|ok|okay|sure|haan|haa|han|ha|ji|ji\s*haan|sahi|"
                    r"sahi\s*hai|theek|theek\s*hai|houdu|haudu|हाँ|हां|सही|ಹೌದು|ಸರಿ)[\s.!?]*$", re.I)
NO_RE = re.compile(r"^\s*(no|n|nope|nahi|nahin|galat|wrong|illa|illaa|ಇಲ್ಲ|नहीं|ग़लत|गलत)[\s.!?]*$", re.I)
CONFIRM_RE = re.compile(r"\b(confirm|yes\s+that|that'?s\s+right|go\s+ahead|use\s+that|perfect)\b", re.I)

#: Subjects a denial can be about.
SUBJECT_WORDS = ("father", "spouse", "husband", "wife", "mother", "parent", "guardian", "pan", "aadhaar",
                 "job", "income", "salary", "address", "phone", "email", "married")


@dataclass
class Answer:
    """One interpreted message."""

    kind: str
    raw: str = ""
    value: str | None = None
    normalized: str | None = None       # a correction we offer, never apply silently
    confidence: float = 1.0
    target: str | None = None
    reason: str = ""
    subject: str = ""                   # for a denial: which thing the citizen says they do not have
    notes: list[str] = field(default_factory=list)

    @property
    def needs_confirmation(self) -> bool:
        return bool(self.normalized) and self.normalized != self.value


# --------------------------------------------------------------------------------------------- denials
def denial(text: str) -> str | None:
    """The subject of a denial ("father"), or None when this is not a denial at all."""
    s = re.sub(r"\s+", " ", re.sub(r"[^a-zऀ-෿ ]+", " ", (text or "").lower())).strip()
    if not s:
        return None
    if not DENIAL_RE.search(s):
        return None
    for w in SUBJECT_WORDS:
        if re.search(rf"\b{w}s?\b", s):
            return w
    return "it"  # a denial we can see but cannot pin on a subject: still not a value


def is_yes(text: str) -> bool:
    return bool(YES_RE.match((text or "").strip()))


def is_no(text: str) -> bool:
    return bool(NO_RE.match((text or "").strip()))


def is_confirmation(text: str) -> bool:
    t = (text or "").strip()
    return is_yes(t) or bool(CONFIRM_RE.search(t))


# --------------------------------------------------------------------------------------------- names and spelling
#: A compact list of common given names: enough to catch a single misspelt token ("prsad" -> "prasad")
#: without a network call, a model, or a heavyweight dependency. Only names are in here, so a surname such as
#: "Pradhan" is never "corrected" to a given name.
COMMON_GIVEN_NAMES = set("""
aarav abhay abhinav adarsh aditya ahmed ajay akash aman amol anand anil ankit arjun arun asha ashim
atul avinash ayush baba badal bala bhaskar bhavana bhavesh bhupinder bijoy chandra deep deepak dinesh divya
durgesh ekta farhan farid fatima gaurav gauri ghanashyam girish gopal gouri gyanesh harish harpreet hemant
indira ishaan jagdish jatin jaya jayesh jignesh kailash kalyan kamal kamesh karan kavita kiran
krishna kunal laxmi leela mahesh mahima manish manoj meera meenakshi mohamed mohit mudassar murali
nagesh nandini narendra naresh naveen nikhil nilanjana nisha nitin nitya omkar padmini parvathi pavan
pooja prabha pradeep pradip pramod prasad prasanth pratap pratik pravin preeti prema priya pushpa rakesh ramesh
ravi rekha renuka rohan rohit rudra sachin sadhana sagar sandeep sangeeta sanjay sanjiv sanjana santosh
sarala sathish satish savita sayali shafiq shahana shailaja shakuntala shalini shankar sheela shekhar
shilpa shobana shreedevi shreya simran sita smita sneha sridevi subhash sudha suman sunanda sunil suresh
susma swarnalata swati tanvi tara tejashree thangamala thulasi triveni umesh usha vaibhav
vandana varun vasudha veena vidya vikram vinod vishal vivek yash yashwant zaheer zainab
""".split())

_NAME_FIELD = {"text", "name", "unknown"}
_ASPIRATED = re.compile(r"(?<=[tdkgbpc])h")


def _sound_key(name: str) -> str:
    """A spelling reduced to how it sounds, so transliteration variants compare equal.

    "Nithin" and "Nitin", "Dhanush" and "Danush", "Shreya" and "Shreeya" are the same name written two ways,
    not typos, and the citizen's own spelling wins. "prsad" and "prasad" still differ (a letter was dropped).
    """
    s = re.sub(r"[^a-z]", "", (name or "").lower())
    s = _ASPIRATED.sub("", s)
    s = re.sub(r"(.)\1+", r"\1", s)
    return s.replace("ee", "i").replace("oo", "u").replace("w", "v").replace("y", "i")


def suggest_spelling(value: str, field_type: str) -> str | None:
    """A confident spelling correction for a personal name, or None.

    Only tokens that are *not* names but sit within one edit of a common given name are corrected, and only
    the token is replaced: "jishnu prsad" -> "Jishnu Prasad".
    """
    if field_type not in _NAME_FIELD or not value or len(value) > 60:
        return None
    out: list[str] = []
    changed = False
    for tok in value.split():
        bare = re.sub(r"[^A-Za-z]", "", tok)
        low = bare.lower()
        if len(bare) < 4 or low in COMMON_GIVEN_NAMES:
            out.append(tok)
            continue
        match = difflib.get_close_matches(low, COMMON_GIVEN_NAMES, n=1, cutoff=0.82)
        if match and _sound_key(low) == _sound_key(match[0]):
            out.append(tok)  # a valid variant spelling of a common name, not a typo
            continue
        if match and difflib.SequenceMatcher(None, low, match[0]).ratio() >= 0.84:
            out.append(tok[:len(tok) - len(bare)] + match[0].capitalize())
            changed = True
            continue
        out.append(tok)
    return " ".join(out) if changed else None


def normalize_name(value: str) -> str:
    """Capitalise a personal name without touching its spelling ("jishnu prasad" -> "Jishnu Prasad")."""
    out: list[str] = []
    for tok in re.split(r"(\s+)", (value or "").strip()):
        if not tok.strip():
            out.append(tok)
            continue
        core = tok.strip(".,'")
        out.append(tok.replace(core, core[:1].upper() + core[1:]) if core else tok)
    return "".join(out)


def clean_value(value: str) -> str:
    """Whitespace tidy-up that never changes wording."""
    return re.sub(r"\s+", " ", (value or "").replace(" ", " ")).strip(" .,;:")


# --------------------------------------------------------------------------------------------- value extraction
_LEAD = (r"(my|mera|meri|mere|our|hamara|hamari|the|its|it is|it's|this is|that is|that's|yeh|ye|woh|wo|"
         r"nanna|namma|मेरा|मेरी|मेरे|हमारा|यह|ನನ್ನ|ನಮ್ಮ)\s+")
_IAM = r"(i am|i'm|im|i m|main|mai|mein|naan|nanu|मैं|ನಾನು)\s+"
_CONNECTOR = r"(?:\s+(?:is|are|was|hai|hain|h|he|will be|should be|would be|ಇದೆ|है)\s*|\s*[:=\-]\s*)"
_LABEL_STOP = {"of", "the", "a", "an", "your", "please", "give", "write", "enter", "specify", "is", "no", "number",
               "details", "name", "and", "or"}


def _label_alternatives(label: str) -> list[str]:
    """How people refer to this field when answering it ("branch", "account number", "pan")."""
    words = [w for w in re.sub(r"[^a-z0-9 ]+", " ", (label or "").lower()).split() if w]
    alts = {" ".join(words)} if words else set()
    alts.update([w for w in words if w not in _LABEL_STOP] or words)
    low = (label or "").lower()
    if re.search(r"\bname\b|father|spouse|husband|wife|parent", low):
        alts.update({"name", "naam", "नाम", "ಹೆಸರು"})
    if re.search(r"account|a/?c", low):
        alts.update({"account number", "account no", "a/c number", "a/c no", "account", "khata", "खाता"})
    if re.search(r"mobile|phone|tel|contact", low):
        alts.update({"mobile number", "phone number", "mobile", "phone", "number"})
    if re.search(r"\bdob\b|date of birth|birth", low):
        alts.update({"dob", "date of birth", "birth date", "जन्म", "जन्म तिथि"})
    if re.search(r"\bpan\b", low):
        alts.update({"pan", "pan number", "pan no"})
    if re.search(r"aadha?ar|uidai", low):
        alts.update({"aadhaar", "aadhar", "aadhaar number", "uidai"})
    return sorted((a for a in alts if a), key=len, reverse=True)


_TRAILING = {"hai", "hain", "h", "he", "ji", "sir", "only", "please", "pls", "thanks", "thank", "you", "hoon", "hun",
             "hu", "ho", "aahe", "ide", "ಇದೆ", "है", "हैं", "हूँ", "हूं", "जी"}


def _strip_trailing(value: str) -> str:
    words = value.split()
    while len(words) > 1 and re.sub(r"[^\wऀ-෿]", "", words[-1].lower()) in _TRAILING:
        words.pop()
    return " ".join(words).strip(" ,.;-")


def extract_value(text: str, label: str) -> tuple[str, float]:
    """The value alone, from a message answering ``label``. Returns (value, extraction confidence).

    Confidence is about the *extraction*, not about whether the value is right: high when a lead phrase or a
    label prefix carried the value ("my name is X"), lower the more the raw sentence is doing the work.
    """
    s = re.sub(r"\s+", " ", (text or "").strip())
    alts = "|".join(re.escape(a) for a in _label_alternatives(label))
    patterns = [
        (rf"^(?:{_LEAD})?\s*(?:{alts})\s*{_CONNECTOR}(?P<v>.+)$", 0.9),
        (rf"^(?:{_LEAD})?\s*(?:{alts})\s+(?P<v>.+)$", 0.85),
        (r"^(?:it is|it's|its|this is|that is|that's|yeh|ye|woh|wo)\s+(?P<v>.+)$", 0.85),
        (rf"^(?:{_IAM})(?P<v>.+)$", 0.8),
        (r"^(?P<v>.+)$", 0.6),
    ]
    for pattern, conf in patterns:
        m = re.match(pattern, s, re.I)
        if not m:
            continue
        v = _strip_trailing(clean_value(m.group("v")))
        if not v:
            continue
        if conf >= 0.8 and len(v.split()) > 12:  # a paragraph in a short field: ask before storing
            conf -= 0.3
        return v, conf
    return "", 0.0


# --------------------------------------------------------------------------------------------- the entry point
def interpret(text: str, field: dict | None, *, cleaned: str | None = None) -> Answer:
    """Interpret one message against the field being asked. Pure code: values never reach an LLM."""
    raw = (text or "").strip()
    s = cleaned if cleaned is not None else re.sub(r"\s+", " ", raw)
    if not s:
        return Answer(kind=OTHER, raw=raw, reason="empty")

    subject = denial(s)
    if subject:
        return Answer(kind=NOT_APPLICABLE, raw=raw, subject=subject,
                      reason="the citizen says they do not have this")
    if NOT_APPLICABLE_RE.search(s) and not re.match(r"^\s*(yes|no|yeah|yep|nahi|nahin)\b", s, re.I):
        return Answer(kind=NOT_APPLICABLE, raw=raw, subject="not applicable", reason="asked to leave it blank")
    if not field:
        return Answer(kind=OTHER, raw=raw, reason="no field being asked")

    value, conf = extract_value(s, label_of(field))
    if not value:
        return Answer(kind=OTHER, raw=raw, reason="nothing left to store")
    ftype = field.get("type") or field.get("input_type") or "text"
    answer = Answer(kind=ANSWER, raw=raw, value=value, confidence=conf)
    if ftype in _NAME_FIELD and not re.search(r"\d", value):
        answer.normalized = suggest_spelling(value, ftype) or normalize_name(value)
    return answer


def label_of(field: dict) -> str:
    return (field or {}).get("label", "")
