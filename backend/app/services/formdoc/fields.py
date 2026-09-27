"""The normalised form schema: one place that decides what a field *is*.

A detected label becomes a field only after it has been normalised into a stable identity:

    "Name of the Applicant"        -> applicant_name       (type: name, required)
    "Father's/ Spouse Name"         -> father_or_spouse_name
    "PAN"                           -> pan_number           (type: identity_number, 10 chars)
    "Date of Birth: __/__/____"    -> date_of_birth        (type: date)
    "Please affix recent photograph"-> (an instruction, not a field at all)

The original ``label`` is never modified: it is what the citizen sees, and PDF filling uses the geometry,
not the label. Everything else (id, type, required, conditional, section, duplicates, order) is derived here
so detection, the assistant, the API and the tests all agree.
"""
from __future__ import annotations

import re
import unicodedata

# --------------------------------------------------------------------------------------------- field types
#: Semantic type -> what the citizen can enter and how it is validated (``values.py``).
FIELD_TYPES = (
    "text", "multiline_text", "date", "number", "email", "phone", "address",
    "checkbox", "radio", "select", "yes_no", "signature", "photograph", "attachment", "table", "unknown",
)
#: Types the citizen completes by hand; the assistant describes them but never writes a value.
MANUAL_TYPES = {"signature", "photograph", "attachment"}
#: Detector type -> schema type.
TYPE_MAP = {
    "text": "text", "name": "text", "multiline": "address", "date": "date", "phone": "phone", "email": "email",
    "identity_number": "text", "bank_account": "text", "ifsc": "text", "pincode": "text", "amount": "number",
    "number": "number", "choice": "select", "checkbox": "checkbox", "signature": "signature",
    "photograph": "photograph", "attachment": "attachment", "table": "table", "unknown": "unknown",
}
#: Sub-type kept for validation and question wording, when it is more specific than the schema type.
SUBTYPE = {"identity_number": "text", "bank_account": "text", "ifsc": "text", "pincode": "text",
           "amount": "number", "choice": "select", "multiline": "address", "name": "text"}
#: Types that are picked from a printed list rather than typed.
CHOICE_TYPES = {"select", "radio", "yes_no", "choice"}
#: Types the citizen types into.
TYPED_TYPES = {"text", "multiline_text", "date", "number", "email", "phone", "address"}


def norm_type(t: str | None) -> str:
    """The schema type of a field, accepting the detector's vocabulary too.

    Rows written by an earlier version of the pipeline keep the detector type in ``type``
    (``choice``, ``multiline``, ``name``, ``identity_number`` …). Everything that asks "can the citizen
    type into this?" or "is this a list of printed options?" goes through here, so old rows and new rows
    behave identically.
    """
    t = (t or "").strip()
    return TYPE_MAP.get(t, t) if t not in FIELD_TYPES else t


def is_choice(f: dict) -> bool:
    return norm_type(f.get("type")) in CHOICE_TYPES


def is_manual(f: dict) -> bool:
    """A field the citizen completes by hand: the assistant never stores a value for it."""
    return norm_type(f.get("type")) in MANUAL_TYPES


def is_typed(f: dict) -> bool:
    return norm_type(f.get("type")) in TYPED_TYPES


def is_conditional(f: dict) -> bool:
    return bool(f.get("conditional")) or bool((f.get("meta") or {}).get("when"))


# --------------------------------------------------------------------------------------------- confidence tiers
#: Three tiers, one rule, applied everywhere: a field detected with more confidence than this is used as it
#: is; below the lower bound it is not a field yet, it is a candidate the citizen confirms in the review panel.
CONF_ACCEPT = 0.90
CONF_REVIEW = 0.70


def confidence_tier(confidence: float | None) -> str:
    """``accepted`` | ``review`` | ``uncertain``."""
    c = float(confidence or 0.0)
    if c >= CONF_ACCEPT:
        return "accepted"
    if c >= CONF_REVIEW:
        return "review"
    return "uncertain"


# --------------------------------------------------------------------------------------------- label vocabulary
ORDERED_ID_RULES: list[tuple[str, str]] = [
    (r"\b(father'?s?|पिता|ತಂದೆ)\b.*\b(spouse'?s?|husband'?s?|wife'?s?|पति|ಸಂಗಾತಿ)", "father_or_spouse_name"),
    (r"\b(spouse'?s?|husband'?s?|wife'?s?|पति|ಸಂಗಾತಿ)\b.*\b(name)?\b", "spouse_name"),
    (r"\b(mother'?s?|माता|ತಂದೆಯ|maa)\b.*\b(name)?\b", "mother_name"),
    (r"\b(name|नाम|ಹೆಸರು)\b.*\b(of\s+the\s+)?(applicant|applicant'?s|self|person|beneficiary|owner)", "applicant_name"),
    (r"^(full\s+)?name$|\b(full|applicant'?s?|first\s*name)\s+name\b", "applicant_name"),
    (r"\b(guardian'?s?|nominee'?s?)\b.*\bname", "guardian_name"),
    (r"\bdate\s+of\s+birth\b|\bd\.?o\.?b\.?\b|\bbirth\s*date\b|\bdate\s+of\s+birth\b", "date_of_birth"),
    (r"\b(date\s+of\s+(issue|joining|appointment|expiry))\b", "date_of_issue"),
    (r"\bpans?\b|permanent\s+account\s+number", "pan_number"),
    (r"\baadha?ar\b|uidai", "aadhaar_number"),
    (r"\b(form\s*60|nil\s+return)", "form_60"),
    (r"\b(ifsc|bank\s+branch\s+code)", "ifsc_code"),
    (r"\b(account\s*(no|number)|a/?c\s*(no|number))", "bank_account_number"),
    (r"\b(mobile|whatsapp)\s*(no|number)?", "mobile_number"),
    (r"\b(phone|tel|telephone|contact)\s*(no|number)?", "phone_number"),
    (r"\b(e-?mail)\b", "email"),
    (r"\b(pin|postal)\s*-?\s*code\b|\bzip\b", "pincode"),
    (r"\b(nationality|citizenship)\b", "nationality"),
    (r"\b(gender|sex)\b", "gender"),
    (r"\b(marital|marriage)\s*(status)?", "marital_status"),
    (r"\b(occupation|profession)\b", "occupation"),
    (r"\b(education|qualification)\b", "education"),
    (r"\b(permanent)\s+address\b", "permanent_address"),
    (r"\b(current|present|residential|residence|correspondence)\s+address\b", "current_address"),
    (r"\b(religion|category|marital)\b", "personal_detail"),
    (r"\b(nationality)\b", "nationality"),
    (r"\b(address|पता|ವಿಳಾಸ)\b", "address"),
    (r"\b(amount|total|income|salary|wage)\b", "amount"),
    (r"\b(date|dining|दिनांक|तारीख|ದಿನಾಂಕ)\b", "date"),
    (r"\b(no|number|reg(istration)?)\b.*\b(number|no)\b", "registration_number"),
    (r"\b(remarks?|comments?|description|details)\b", "remarks"),
    (r"\b(name|नाम|ಹೆಸರು)\b", "name"),
]
#: Words that carry no meaning in an identifier.
_ID_STOP = {"the", "of", "a", "an", "and", "or", "your", "please", "give", "write", "enter", "specify",
            "name", "no", "number", "details", "detail", "is", "to", "in", "for", "mention", "full"}
_COMBINING = re.compile(r"[\u0300-\u036f]")
_NON_WORD = re.compile(r"[^a-z0-9ऀ-෿]+")


def _fold(text: str) -> str:
    """Lower-case and strip accents, so "Région" and "region" are the same key."""
    return _COMBINING.sub("", unicodedata.normalize("NFD", text or ""))


def normalize_label(label: str) -> str:
    """A stable identifier for a label, shared by detection, de-duplication and the assistant.

    Known labels map to a canonical id ("father_or_spouse_name"); anything else becomes a readable slug
    built from its content words, so two different labels never collide by accident.
    """
    raw = re.sub(r"\s+", " ", (label or "")).strip()
    flat = _NON_WORD.sub(" ", _fold(raw).lower()).strip()
    flat = re.sub(r"\s+", " ", flat)
    for pattern, ident in ORDERED_ID_RULES:
        if re.search(pattern, flat):
            return ident
    words = [w for w in flat.split() if w not in _ID_STOP]
    if not words:
        words = [w for w in flat.split() if w]
    slug = "_".join(words[:4]) or "field"
    return slug[:60].strip("_") or "field"


def semantic_key(label: str) -> str:
    """Key used to spot duplicates ("Name", "Name of Applicant", "Applicant Name" -> one field)."""
    flat = _NON_WORD.sub(" ", _fold(label or "").lower()).strip()
    words = {w for w in flat.split() if w not in _ID_STOP and len(w) > 2}
    if not words:
        words = set(flat.split())
    return " ".join(sorted(words))


# --------------------------------------------------------------------------------------------- requiredness
_REQUIRED_MARK = re.compile(r"[\*†‡]|\bmandatory\b|\bcompulsory\b|\brequired\b|\bis\s+required\b", re.I)
_OPTIONAL_HINT = re.compile(r"\boptional\b|\bif\s+available\b|\bif\s+applicable\b|\bwhere\s+applicable\b|"
                            r"\bif\s+any\b|\bnot\s+mandatory\b|\boptional\s*:", re.I)


def requiredness(label: str, description: str = "", context: str = "") -> bool | None:
    """True/False from the printed wording, or None when the form does not say."""
    text = f"{label} {description} {context}"
    if _REQUIRED_MARK.search(label) or _REQUIRED_MARK.search(description):
        return True
    if _OPTIONAL_HINT.search(text):
        return False
    return None


# --------------------------------------------------------------------------------------------- conditions
#: A field is conditional when its own wording says so ("if applicable", "only if …", "in case of …").
CONDITIONAL_HINT = re.compile(r"\b(if\s+applicable|where\s+applicable|only\s+if|in\s+case\s+of|"
                              r"if\s+you\s+are|if\s+the|as\s+applicable|optional)\b", re.I)
#: Wording that ties a field to an earlier answer. Deliberately narrow: "Residential Address" or "Father's/
#: Spouse Name" are ordinary fields and must never be treated as conditional.
CONDITION_RULES: list[tuple[str, str]] = [
    (r"\b(spouse|husband|wife)\b", "spouse"),
    (r"\bform\s*60\b|\bpan\s+(is\s+)?not\s+(available|allotted|held)|\b(no|without)\s+pan\b", "pan_unavailable"),
    (r"\b(non-?resident|foreigner|overseas|nri|oci)\b", "non_resident"),
    (r"\bminor\b|\bguardian\b", "minor"),
]
#: kind -> (trigger id, trigger label hint, answers that switch the field ON, answers that switch it OFF).
#: An answer in neither list ("Divorced", "Widowed", anything unexpected) leaves the field relevant.
_CONDITION_OPTIONS = {
    "spouse": ("married", "marital status", ("married", "yes"),
               ("unmarried", "single", "not married", "never married", "no")),
    "pan_unavailable": ("pan", "pan availability", ("no", "not available", "unavailable", "nil"),
                        ("yes", "available", "have pan")),
    "non_resident": ("citizenship", "citizenship", ("non-resident", "non resident", "foreigner", "nri", "oci", "overseas"),
                     ("resident", "resident individual", "indian", "citizen")),
    "minor": ("age", "age", ("minor", "under 18", "below 18"),
              ("adult", "major", "18 or above", "above 18", "over 18")),
}
#: A parent's name is never conditional on the applicant's marital status, even when the label also says "spouse".
_PARENT_WORDS = re.compile(r"\b(father|mother|parent)\b", re.I)


def _has_word(text: str, word: str) -> bool:
    """Whole-word match, so "married" is not found inside "unmarried"."""
    return bool(re.search(rf"(?<![a-z0-9]){re.escape(word)}(?![a-z0-9])", text))


def condition_for(label: str, description: str, anchor: str = "") -> dict | None:
    """A ``when`` clause for a field, inferred from its own wording and the nearest question above it.

    ``{"kind": "spouse", "field": <trigger id>, "equals": [ON answers], "not_equals": [OFF answers]}`` or None.
    Nothing is invented: without a plausible trigger the field is treated as always relevant.
    """
    text = f"{label} {description} {anchor}".lower()
    for pattern, kind in CONDITION_RULES:
        if not re.search(pattern, text):
            continue
        if kind == "spouse" and _PARENT_WORDS.search(label or ""):
            continue
        base, label_hint, on, off = _CONDITION_OPTIONS[kind]
        clause = {"kind": kind, "equals": list(on), "not_equals": list(off), "reason": "wording"}
        if anchor and re.search(rf"\b{re.escape(base)}\b", anchor.lower()):
            return {**clause, "field": normalize_label(anchor)}
        return {**clause, "field": base, "label_hint": label_hint, "anchor": anchor or ""}
    return None


def condition_applies(when: dict, fields: list[dict], values: dict) -> bool:
    """Is a conditional field relevant with the answers given so far?

    Fails safe: the field is hidden only when its trigger was answered with an explicit "does not apply"
    value. An unknown trigger, an unanswered trigger or an unexpected answer keeps the question in play, so a
    field is never dropped because the pipeline misjudged the form.
    """
    if not when:
        return True
    trigger = when.get("field")
    hint = str(when.get("label_hint") or "").lower()
    anchor = str(when.get("anchor") or "").lower()
    candidates = [f for f in fields
                  if f.get("normalized_label") == trigger
                  or (anchor and f.get("label", "").lower() == anchor)
                  or (hint and _has_word(f.get("label", "").lower(), hint))]
    on = [str(a).strip().lower() for a in when.get("equals", []) if str(a).strip()]
    off = [str(a).strip().lower() for a in when.get("not_equals", []) if str(a).strip()]
    ruled_out = False
    for f in candidates:
        if f["field_id"] not in values:
            continue
        v = values[f["field_id"]]
        for item in (v if isinstance(v, list) else [v]):
            answer = str(item).strip().lower()
            if any(_has_word(answer, a) for a in on):
                return True
            if any(_has_word(answer, a) for a in off):
                ruled_out = True
    return not ruled_out


def field_applies(f: dict, fields: list[dict], values: dict) -> bool:
    """Is this field relevant with the answers given so far?

    The ``when`` clause is taken from the field's own ``meta`` when the detector stored one, and re-derived
    from the printed wording otherwise. An unknown trigger is treated as relevant: a question is never
    hidden because the pipeline could not work out whether it applies.
    """
    when = (f.get("meta") or {}).get("when")
    if not when and (f.get("conditional") or CONDITIONAL_HINT.search(f.get("label", ""))):
        when = condition_for(f.get("label", ""), f.get("description", ""), f.get("section", ""))
    return condition_applies(when, fields, values)


# --------------------------------------------------------------------------------------------- duplicates
#: Two identical labels further apart than this are two different questions, not one field detected twice.
NEAR_SAME_FIELD_PT = 26.0


def same_label(a: dict, b: dict) -> bool:
    if a.get("normalized_label") and a["normalized_label"] == b.get("normalized_label"):
        return True
    ka, kb = semantic_key(a.get("label", "")), semantic_key(b.get("label", ""))
    return bool(ka) and ka == kb


def duplicate_of(a: dict, b: dict) -> bool:
    """Are two detected fields the same logical field? Never merges on geometry alone.

    The same label printed twice on one page is *not* automatically a duplicate: "City/town/village"
    appears in the residence block and again in the permanent-address block, and each needs its own
    answer. Only instances that sit on top of each other (or within a line's height) are the same field
    detected twice, usually by two overlapping detection rules.
    """
    if a.get("page") != b.get("page"):
        return False
    if not same_label(a, b):
        return False
    ba, bb = a.get("page_bbox") or a.get("bbox") or [], b.get("page_bbox") or b.get("bbox") or []
    if len(ba) == 4 and len(bb) == 4:
        overlap_x = min(ba[2], bb[2]) - max(ba[0], bb[0])
        overlap_y = min(ba[3], bb[3]) - max(ba[1], bb[1])
        gap_y = max(ba[1], bb[1]) - min(ba[3], bb[3])
        # Same row (or the same answer area twice), or one line apart in the same column: one field.
        if overlap_y <= 0 and (overlap_x <= 0 or gap_y > NEAR_SAME_FIELD_PT):
            return False
    return True


def dedupe(fields: list[dict]) -> tuple[list[dict], list[dict]]:
    """Keep the best instance of each logical field. Returns (kept, merged-away with their alias)."""
    kept: list[dict] = []
    merged: list[dict] = []
    for f in fields:
        twin = next((k for k in kept if duplicate_of(k, f)), None)
        if twin is None:
            kept.append(f)
            continue
        # The instance with real input evidence (or the higher confidence) wins; the other becomes an alias
        # so the citizen still sees both labels in the review list.
        loser = f if _rank(f) >= _rank(twin) else twin
        winner = twin if loser is f else f
        aliases = list(dict.fromkeys([*(winner.get("aliases") or []), loser.get("label", "")]))
        if loser is twin:
            kept[kept.index(twin)] = winner
        winner["aliases"] = [a for a in aliases if a and a != winner.get("label")]
        winner.setdefault("normalized_label", winner.get("normalized_label") or normalize_label(winner.get("label", "")))
        loser["normalized_label"] = winner["normalized_label"]
        merged.append({"field_id": loser.get("field_id", ""), "label": loser.get("label", ""),
                       "page": loser.get("page", 0), "bbox": loser.get("bbox") or loser.get("page_bbox") or [],
                       "into": winner.get("label", ""), "page_bbox": loser.get("page_bbox") or []})
    return kept, merged


def _rank(f: dict) -> tuple:
    conf = f.get("confidence") or 0.0
    has_box = bool(f.get("bbox") or f.get("page_bbox"))
    return (1 if has_box else 0, conf)


# --------------------------------------------------------------------------------------------- ordering
def reading_order(fields: list[dict]) -> list[dict]:
    """Page order, then section order, then position inside the section (top to bottom, left to right).

    Retrieval never decides which question comes next; this does.
    """
    def key(f: dict):
        page = f.get("page") or 1
        bbox = f.get("bbox") or f.get("page_bbox") or [0, 0, 0, 0]
        section = f.get("section") or ""
        return (page, _fold(section).lower(), round(bbox[1] / 6), round(bbox[0] / 6),
                f.get("position", 0))

    return sorted(fields, key=key)
