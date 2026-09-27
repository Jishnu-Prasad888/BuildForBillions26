"""AutoFill values: validation, display/masking, and profile-based suggestions.

Values are stored as {"v": <str | bool | list[str]>}. Nothing in this module logs a value.
"""
from __future__ import annotations

import re
from datetime import date

from app.services.forms import normalize_digits, parse_date

NON_FILLABLE = {"signature"}
#: Completed by hand after printing: the citizen attaches these, the assistant never writes into them.
HAND_FILL_TYPES = {"signature", "photograph", "attachment"}
# Fields the assistant must never collect: it never handles OTPs, passwords or PINs.
SECRET_LABEL = re.compile(r"\b(otp|one[- ]time|password|passcode|cvv|atm pin|upi pin|mpin)\b|\bpin\b(?!\s*-?code)", re.I)


def is_secret_field(field: dict) -> bool:
    return bool(SECRET_LABEL.search(field["label"]))  # the citizen signs the printed/completed form by hand; the AI never fills these


class ValueError_(ValueError):
    """Validation failure with a user-facing message. ``options`` set when a choice was ambiguous."""

    def __init__(self, message: str, options: list[str] | None = None):
        super().__init__(message)
        self.options = options or []


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", " ", s.lower()).strip()


def match_options(field_options: list[str], text: str) -> list[str]:
    """Every option the text refers to (exact match wins; otherwise word/substring matches)."""
    low = _norm(text)
    if not low:
        return []
    exact = [o for o in field_options if _norm(o) == low]
    if exact:
        return exact[:1]
    if re.fullmatch(r"\d{1,2}", low):  # "2" -> second option
        i = int(low) - 1
        if 0 <= i < len(field_options):
            return [field_options[i]]
    hits = []
    for o in field_options:
        n = _norm(o)
        if not n:
            continue
        if re.search(rf"(?<![a-z0-9]){re.escape(n)}(?![a-z0-9])", low):
            hits.append(o)
        else:
            words = [w for w in n.split() if len(w) > 3]
            if words and all(re.search(rf"(?<![a-z0-9]){re.escape(w)}", low) for w in words):
                hits.append(o)
    if not hits:  # the user typed a part of an option: "licence" -> "Driving Licence"
        hits = [o for o in field_options if len(low) >= 3 and low in _norm(o)]
    return hits


def _id_kind(field: dict, siblings: dict) -> str:
    """'aadhaar' | 'pan' | 'other' — from the label, or from a choice field like 'Identity Document' answered earlier."""
    label = field["label"].lower()
    if "aadhaar" in label or "aadhar" in label:
        return "aadhaar"
    if re.search(r"\bpan\b", label):
        return "pan"
    for other in siblings.get("choices", []):
        v = (other or "").lower()
        if "aadhaar" in v or "aadhar" in v:
            return "aadhaar"
        if re.search(r"\bpan\b", v):
            return "pan"
    return "other"


#: Fine-grained validator for each *detector* type. The schema type is coarse ("text" for a PAN, an IFSC and
#: a plain sentence), so the sub-type decides how strict the check is — and it is always named explicitly,
#: never guessed from the words in the label.
def _validation_kind(field: dict) -> str:
    sub = (field.get("input_type") or "").strip()
    if sub in ("identity_number", "bank_account", "ifsc", "pincode", "amount", "choice", "checkbox",
               "signature", "photograph", "attachment", "date", "phone", "email", "multiline", "name", "number", "text"):
        return sub
    t = field.get("type") or "text"
    if t in ("identity_number", "bank_account", "ifsc", "pincode", "amount", "name", "multiline", "choice"):
        return t  # a row written before the schema switch
    if t == "address" or t == "multiline_text":
        return "multiline"
    if t in ("select", "radio", "yes_no"):
        return "choice"
    return t


def validate_value(field: dict, raw, siblings: dict | None = None):
    """Returns the normalised value or raises ValueError_. ``siblings`` = {"choices": [answers of choice fields]}."""
    siblings = siblings or {}
    t = _validation_kind(field)
    if is_secret_field(field):
        raise ValueError_("For your safety I never collect OTPs, passwords or PINs. Please enter this yourself on the completed form.")
    if t in NON_FILLABLE:
        raise ValueError_("Signatures must be added by you on the completed form. I can't fill this one.")
    if t == "checkbox":
        if isinstance(raw, bool):
            return raw
        s = str(raw).strip().lower()
        if s in ("true", "yes", "y", "1", "checked", "tick", "on", "haan", "हाँ", "ಹೌದು"):
            return True
        if s in ("false", "no", "n", "0", "unchecked", "off", "", "नहीं", "ಇಲ್ಲ"):
            return False
        raise ValueError_("Please answer yes or no.")
    if t == "choice":
        opts = field.get("options") or []
        if field.get("meta", {}).get("multiple"):
            items = raw if isinstance(raw, list) else re.split(r"\s*(?:,|;|\band\b|&)\s*", str(raw))
            chosen: list[str] = []
            for it in items:
                m = match_options(opts, str(it))
                if len(m) != 1:
                    raise ValueError_(f"“{it}” is not one of the options.", opts)
                if m[0] not in chosen:
                    chosen.append(m[0])
            if not chosen:
                raise ValueError_("Please pick at least one option.", opts)
            return chosen
        m = match_options(opts, str(raw))
        if len(m) == 1:
            return m[0]
        if len(m) > 1:
            raise ValueError_("More than one option matches.", m)
        raise ValueError_("That is not one of the options on the form.", opts)

    s = normalize_digits(str(raw)).strip()
    if not s:
        raise ValueError_("Please enter a value.")
    if len(s) > 600 or re.search(r"[\x00-\x08\x0b-\x1f\x7f]", s):
        raise ValueError_("That value is not valid.")
    if t == "date":
        iso = parse_date(s)
        if not iso:
            raise ValueError_("I couldn't read that date. Please use DD/MM/YYYY, for example 25/12/1990.")
        if iso > date.today().isoformat() and re.search(r"birth|dob", field["label"], re.I):
            raise ValueError_("A date of birth can't be in the future.")
        return iso
    if t == "phone":
        d = re.sub(r"\D", "", s)
        if d.startswith("91") and len(d) == 12:
            d = d[2:]
        if len(d) == 11 and d.startswith("0"):
            d = d[1:]
        if not re.fullmatch(r"[6-9]\d{9}", d):
            raise ValueError_("A mobile number has 10 digits and starts with 6, 7, 8 or 9.")
        return d
    if t == "email":
        if not re.fullmatch(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}", s):
            raise ValueError_("That doesn't look like an email address.")
        return s.lower()
    if t == "identity_number":
        v = re.sub(r"[\s\-]", "", s).upper()
        kind = _id_kind(field, siblings)
        if kind == "aadhaar" or (kind == "other" and re.fullmatch(r"\d{12}", v)):
            if not re.fullmatch(r"[2-9]\d{11}", v):
                raise ValueError_("An Aadhaar number has 12 digits and doesn't start with 0 or 1.")
            return f"{v[:4]} {v[4:8]} {v[8:]}"
        if kind == "pan" or re.fullmatch(r"[A-Z]{5}\d{4}[A-Z]", v):
            if not re.fullmatch(r"[A-Z]{5}\d{4}[A-Z]", v):
                raise ValueError_("A PAN looks like ABCDE1234F (5 letters, 4 digits, 1 letter).")
            return v
        if not re.fullmatch(r"[A-Z0-9/]{6,20}", v):
            raise ValueError_("That identity number doesn't look right. Use 6-20 letters and digits.")
        return v
    if t == "bank_account":
        d = re.sub(r"\D", "", s)
        if not 9 <= len(d) <= 18:
            raise ValueError_("A bank account number has 9 to 18 digits.")
        return d
    if t == "ifsc":
        v = re.sub(r"[^A-Za-z0-9]", "", s).upper()
        if not re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}", v):
            raise ValueError_("An IFSC has 11 characters, like SBIN0001234 (a zero as the fifth character).")
        return v
    if t == "pincode":
        d = re.sub(r"\D", "", s)
        if not re.fullmatch(r"[1-9]\d{5}", d):
            raise ValueError_("A PIN code has 6 digits.")
        return d
    if t in ("amount", "number"):
        n = re.sub(r"[,\s₹]|rs\.?|rupees|%|acres?|hectares?|years?", "", s, flags=re.I)
        if not re.fullmatch(r"\d+(\.\d+)?", n):
            raise ValueError_("Please enter a number.")
        return n
    if t in ("name",) and not re.search(r"[^\W\d_]", s):
        raise ValueError_("A name should contain letters.")
    if t == "name" and len(s) > 120:
        raise ValueError_("That name is too long.")
    return re.sub(r"[ \t]+", " ", s)


def to_display(field: dict, value) -> str:
    """What is written on the form."""
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, list):
        return ", ".join(value)
    if _validation_kind(field) == "date" and isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        y, m, d = value.split("-")
        return f"{d}/{m}/{y}"
    return "" if value is None else str(value)


def mask(field: dict, value) -> str:
    """Display for review screens: identity and bank numbers show only the last four characters."""
    s = to_display(field, value)
    if _validation_kind(field) in ("identity_number", "bank_account") and len(re.sub(r"\s", "", s)) > 4:
        compact = re.sub(r"\s", "", s)
        return "•" * (len(compact) - 4) + compact[-4:]
    return s


def is_sensitive(field: dict) -> bool:
    return _validation_kind(field) in ("identity_number", "bank_account", "phone", "multiline", "ifsc") or bool(re.search(r"aadhaar|pan\b|address|account", field["label"], re.I))


# --------------------------------------------------------------------------- profile suggestions
_TEXT = ("text", "name")
_PROFILE_MAP = [  # (label pattern, profile key, field types it may fill)
    # "Father's/ Spouse Name" but not "Father's occupation": the label has to be asking for a name.
    (re.compile(r"^(?=.*\b(?:father|spouse|husband)\b)(?=.*\bname\b)", re.I), "father_name", _TEXT),
    (re.compile(r"date of birth|\bdob\b|birth\s*date", re.I), "dob", ("date",)),
    (re.compile(r"nationality|citizenship", re.I), "nationality", _TEXT),
    # Starts with "address" (optionally "Residence address" etc.), so "Specify the proof of address submitted" doesn't match.
    (re.compile(r"^(?:(?:residen\w*|permanent|current|present|correspondence)\s+)?address\b", re.I), "address", ("multiline", "text")),
    (re.compile(r"pin\s*-?code|postal code|\bzip\b", re.I), "pincode", ("pincode",)),
    (re.compile(r"\bcountry\b", re.I), "country", _TEXT),
    (re.compile(r"e-?mail", re.I), "email", ("email",)),
    (re.compile(r"\bstate\b", re.I), "state", _TEXT),
    (re.compile(r"district", re.I), "district", _TEXT),
    (re.compile(r"taluk|taluka|tehsil", re.I), "taluk", _TEXT),
    (re.compile(r"village", re.I), "village", _TEXT),
    (re.compile(r"occupation|profession", re.I), "occupation", _TEXT),
]
# A phone field is only filled with the citizen's mobile number when the label doesn't ask for someone else's or another line.
_NOT_MY_MOBILE = re.compile(r"father|mother|guardian|alternate|office|\boff\b|\bres\b|resid|fax|landline", re.I)


def profile_suggestions(fields: list[dict], user_full_name: str, profile: dict) -> dict[str, str]:
    """Values from the citizen's own profile for fields whose meaning is unambiguous. Suggestions only; code, never an LLM."""
    out: dict[str, str] = {}
    for f in fields:
        label, ftype = f["label"], _validation_kind(f)
        if ftype in ("choice", "checkbox", "signature"):
            continue
        if ftype == "name" and re.search(r"applicant|full name|^name$|^name of", label, re.I) and not re.search(r"father|mother|husband|spouse|guardian|nominee", label, re.I):
            if user_full_name:
                out[f["field_id"]] = user_full_name
            continue
        if ftype == "phone":
            if profile.get("phone") and not _NOT_MY_MOBILE.search(label):
                out[f["field_id"]] = str(profile["phone"])
            continue
        for rx, key, types in _PROFILE_MAP:
            if ftype in types and profile.get(key) and rx.search(label):
                out[f["field_id"]] = str(profile[key])
                break
    return out
