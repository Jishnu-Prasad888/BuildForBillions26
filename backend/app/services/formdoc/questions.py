"""Turning a detected field into something a person would actually ask.

The assistant must never say "I found a field called X. Do you know it?". It says "What is your date of
birth?", or, for a label it cannot turn into a question, explains the field and asks for the value.

Wording is generated from the field itself (label, type, options, section, help text) plus a small glossary of
terms that appear on Indian government forms. Nothing here calls a model, so the question asked is always
traceable to what the document actually says.
"""
from __future__ import annotations

import re

#: Field types the citizen completes by hand; the assistant explains them and never asks for a value.
MANUAL_HINT = {
    "signature": "You sign this one by hand on the completed form.",
    "photograph": "This one needs a photograph pasted in the box, so I will leave it for you.",
    "attachment": "This one needs a document attached, so I will leave it for you.",
}

#: Short explanation of a term that is otherwise jargon ("PAN" -> "10-character Permanent Account Number").
GLOSSARY: dict[str, str] = {
    "pan": "your 10-character Permanent Account Number, like ABCDE1234F",
    "aadhaar": "your 12-digit Aadhaar number",
    "aadhar": "your 12-digit Aadhaar number",
    "ifsc": "your bank's 11-character IFSC code, printed on your passbook",
    "kyc": "Know Your Customer",
    "nec": "National Employment Certificate",
    "uidai": "the UIDAI agency that issues Aadhaar",
    "upi": "Unified Payments Interface",
    "epfo": "the Employees' Provident Fund Organisation",
    "esic": "the Employees' State Insurance Corporation",
    "gstin": "your 15-character GST identification number",
    "tan": "your 10-character Tax Account Number",
    "upi id": "your UPI ID, like name@bank",
    "pincode": "your 6-digit PIN code",
    "dob": "your date of birth",
    "ration card": "your ration card number",
    "voter": "your voter ID number",
    "passport": "your passport number",
    "licence": "your driving licence number",
    "mmt": "Ministry of Micro, Small and Medium Enterprises",
}

_COMPOUND = re.compile(r"^(?P<a>[^/]+?)\s*/\s*(?:or\s+)?(?P<b>[^/]+)$", re.I)
_LEAD_NOUNS = ("name", "date", "number", "address", "amount", "code", "id", "type", "status", "details", "no")
#: What a field "asks for", by detector or schema type, completing the sentence "“<label>” asks for …".
_ASKS_FOR = {
    "text": "a short written answer",
    "multiline_text": "a longer written answer",
    "date": "a date",
    "number": "a number",
    "email": "an email address",
    "phone": "a 10-digit mobile number",
    "address": "your full address",
    "checkbox": "a yes or no: tick it only if it applies to you",
    "yes_no": "a yes or no answer",
    "identity_number": "the number printed on your identity document",
    "bank_account": "your bank account number (9 to 18 digits, printed in your passbook or on a cheque)",
    "ifsc": "your bank branch's IFSC code (11 characters, printed in your passbook or on a cheque)",
    "pincode": "your 6-digit PIN code",
}


def glossary_for(text: str) -> tuple[str, list[str]]:
    """(explanation, terms found) for any known term in the label."""
    low = f" {text.lower()} "
    hits = [term for term in GLOSSARY if re.search(rf"(?<![a-z]){re.escape(term)}(?![a-z])", low)]
    if not hits:
        return "", []
    return "; ".join(GLOSSARY[h] for h in hits[:2]), hits


def is_compound(label: str) -> tuple[str, str] | None:
    """"Father's / Spouse Name" -> ("Father's", "Spouse Name"): a label with two alternatives in it."""
    m = _COMPOUND.match((label or "").strip())
    if not m:
        return None
    a, b = m.group("a").strip(), m.group("b").strip()
    if not a or not b or len(a) > 40 or len(b) > 40:
        return None
    return a, b


def _possessive_phrase(label: str) -> str | None:
    """"Father's/ Spouse Name" -> "your father's or your spouse's name"."""
    if not re.search(r"\bname\b", label, re.I):
        return None
    head = re.sub(r"\bname\b.*$", "", label, flags=re.I)
    parts = [p.strip() for p in re.split(r"[/,]| or | and ", head) if p.strip()]
    if len(parts) < 2:
        return None
    reads = []
    for p in parts[:3]:
        p = re.sub(r"'s?$", "", p.strip())
        if not p:
            continue
        reads.append(f"your {p.lower()}'s")
    if len(reads) < 2:
        return None
    return " or ".join(reads[:-1]) + f" or {reads[-1]}"


def question_for(field: dict) -> str:
    """The question to ask for this field, in the citizen's words."""
    label = (field.get("label") or "").strip()
    ftype = field.get("type") or field.get("input_type") or "text"
    ftype = {"name": "text", "multiline": "multiline_text", "choice": "select", "amount": "number",
             "identity_number": "text", "bank_account": "text", "ifsc": "text", "pincode": "text"}.get(ftype, ftype)

    if ftype in MANUAL_HINT:
        return f"{MANUAL_HINT[ftype]} ({label})" if label else MANUAL_HINT[ftype]

    if ftype == "select" and field.get("options"):
        opts = list(field["options"])[:6]
        return f"For “{label}” the form offers: {', '.join(opts)}. Which one applies to you?"

    compound = _possessive_phrase(label)
    if compound:
        return f"The form asks for {compound}. Which one applies to you?"

    if ftype == "date" and re.search(r"\b(birth|dob|born)\b", label, re.I):
        return "What is your date of birth? (for example 25/12/1990)"
    if re.fullmatch(r"(?i)\s*(full\s+)?name\s*", label) or field.get("normalized_label") == "applicant_name":
        return "What is your full name?"

    explanation, terms = glossary_for(f"{label} {field.get('description', '')}")
    if terms:
        if ftype in ("text", "unknown") and re.search(r"\b(pan|aadha?ar|uidai|ifsc|voter|passport|licence|ration)\b",
                                                      label, re.I):
            return f"The form asks for your {', '.join(terms[:2])} — {explanation}. What should I enter?"
        if ftype == "date":
            return f"What date should I enter for “{label}”? ({explanation})"

    noun = _head_noun(label)
    if noun:
        return f"What is your {noun}?"
    if label:
        return f"The form asks: {label}. What should I enter there?"
    return "What should I enter here?"


def _head_noun(label: str) -> str | None:
    """A plain-English noun phrase for the label, when it is a simple "… Name" / "… Number" style field."""
    text = re.sub(r"^\s*\(?\d{1,2}[).:]?\s*", "", (label or "").strip())
    text = re.sub(r"[*_]+$", "", text).strip(" :")
    if not text or len(text) > 60:
        return None
    if text.endswith("?"):
        return None
    if is_compound(text):
        return None
    low = text.lower()
    if re.search(r"\b(please|kindly|note|attach|affix|tick|write|specify|give|enter|mandatory|required|"
                 r"optional|if\s+applicable|only\s+if|for\s+office|basis|documents?\b|application|form)\b", low):
        return None
    text = re.sub(r"\s*\(.*?\)\s*", " ", text).strip()
    text = re.sub(r"\b(the|your|my|of)\b\s*", "", text, flags=re.I).strip()
    if not text:
        return None
    words = text.split()
    if not words:
        return None
    last = words[-1].lower().strip(":")
    if last not in _LEAD_NOUNS and last not in ("id", "no", "pin", "type", "category", "occupation", "gender",
                                                "religion", "nationality", "income", "salary", "bank", "branch"):
        return None
    phrase = " ".join(words).lower()
    return phrase if len(phrase) <= 60 else None


def context_for(field: dict) -> str:
    """One extra line of context (section, help text) shown under the question."""
    bits = []
    if field.get("section"):
        bits.append(f"Section: {field['section']}.")
    if field.get("description"):
        bits.append(f"The form says: “{field['description']}”.")
    if field.get("required"):
        bits.append("This one is required.")
    return " ".join(bits)


def explain_field(field: dict) -> str:
    """Plain explanation of a field, used by "I don't know" and "what does this mean?"."""
    label = (field.get("label") or "").strip()
    ftype = field.get("input_type") or field.get("type") or "text"
    ftype = {"choice": "select", "multiline": "multiline_text", "name": "text", "amount": "number"}.get(ftype, ftype)
    compound = _possessive_phrase(label)
    if compound:
        sentences = [f"“{label}” asks for {compound}."]
    elif ftype == "select" and field.get("options"):
        sentences = [f"“{label}” asks for one of these options: " + "; ".join(field["options"][:6]) + "."]
    elif ftype in MANUAL_HINT:
        sentences = [f"“{label}”: " + MANUAL_HINT[ftype]]
    else:
        sentences = [f"“{label}” asks for " + _ASKS_FOR.get(ftype, "the information named in the label") + "."]
    _, terms = glossary_for(f"{label} {field.get('description', '')}")
    if terms:
        term = terms[0]
        sentences.append(f"Here {term.upper() if len(term) <= 4 else term} means {GLOSSARY[term]}.")
    if field.get("description"):
        sentences.append(f"The form says: “{field['description']}”.")
    sentences.append("It is required." if field.get("required") else "It is optional.")
    return " ".join(sentences)


def denial_response(field: dict, subject: str) -> tuple[str, list[str]]:
    """What to say when the citizen says they do not have what a field asks for.

    Never invents personal information: the citizen chooses between leaving it blank and marking it as not
    applicable, or giving the other half of a compound label.
    """
    label = (field.get("label") or "").strip()
    compound = is_compound(label)
    if compound:
        first, second = compound
        return (f"I understand. This field accepts either {first.lower()} or {second.lower()}. "
                f"If neither applies to you, I can leave it blank or mark it as not applicable. Which should I use?",
                [f"Use {first}", f"Use {second}", "Leave blank", "Not applicable"])
    what = subject if subject and subject != "it" else "it"
    return (f"I understand — you do not have {what}. I will not guess this. I can leave “{label}” blank, or mark it "
            f"as not applicable. Which would you prefer?", ["Leave blank", "Not applicable", "Tell me more"])
