"""Form definitions (demo government forms) + value parsing/validation."""
from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta
from functools import lru_cache

from app.config import settings

DIGIT_MAP = str.maketrans("०१२३४५६७८९೦೧೨೩೪೫೬೭೮೯", "01234567890123456789")


@lru_cache
def load_forms() -> dict[str, dict]:
    out = {}
    for p in sorted((settings.seed_path / "forms").glob("*.json")):
        f = json.loads(p.read_text(encoding="utf-8"))
        out[f["id"]] = f
    return out


def get_form(form_id: str | None) -> dict | None:
    return load_forms().get(form_id or "")


def all_fields(form: dict) -> list[dict]:
    return [{**f, "section_id": s["id"], "section_title": s["title"], "section_titles": s.get("titles", {})}
            for s in form["sections"] for f in s["fields"]]


def resolve_field(field: dict, values: dict) -> dict:
    """Apply dynamic variants (e.g. id_number label depends on id_type)."""
    if field.get("depends_on") and field.get("variants"):
        v = field["variants"].get(values.get(field["depends_on"]) or "")
        if v:
            return {**field, **v}
    return field


def field_label(field: dict, lang: str) -> str:
    return (field.get("labels") or {}).get(lang) or field["label"]


def section_title(section_or_field: dict, lang: str) -> str:
    titles = section_or_field.get("titles") or section_or_field.get("section_titles") or {}
    return titles.get(lang) or section_or_field.get("title") or section_or_field.get("section_title", "")


def option_display(field: dict, lang: str) -> list[str]:
    labels = (field.get("option_labels") or {}).get(lang)
    return labels if labels and len(labels) == len(field["options"]) else field["options"]


def is_filled(field: dict, values: dict) -> bool:
    v = values.get(field["id"])
    if field["type"] == "checkbox":
        return v is True
    return v not in (None, "", [])


def compute_status(form: dict, values: dict, skipped: set[str] | None = None) -> tuple[dict, int]:
    skipped = skipped or set()
    status, done, total = {}, 0, 0
    for f in all_fields(form):
        if is_filled(f, values):
            status[f["id"]] = "COMPLETE"
        else:
            status[f["id"]] = "SKIPPED" if f["id"] in skipped else "PENDING"
        if f.get("required"):
            total += 1
            done += status[f["id"]] == "COMPLETE"
    return status, round(100 * done / total) if total else 0


def section_progress(form: dict, values: dict) -> list[dict]:
    out = []
    for s in form["sections"]:
        done = sum(is_filled(f, values) for f in s["fields"])
        out.append({"id": s["id"], "title": s["title"], "titles": s.get("titles", {}), "done": done, "total": len(s["fields"]),
                    "complete": done == len(s["fields"])})
    return out


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------
LEAD_PHRASES = [
    r"^(my|the)\s+[\w']+(\s+[\w']+)?\s+(is|are)\s+", r"^it'?s\s+", r"^it is\s+", r"^i am\s+", r"^i'm\s+", r"^this is\s+", r"^name is\s+",
    r"^मेरा\s+\S+\s+", r"^मेरी\s+\S+\s+", r"^ನನ್ನ\s+\S+\s+",
]
TRAIL_PHRASES = [r"\s+है$", r"\s+हैं$", r"\s+ಆಗಿದೆ$", r"\s+ಇದೆ$"]

OPTION_SYNONYMS = {
    "Aadhaar": ["aadhaar", "aadhar", "adhar", "aadhaar card", "uid", "आधार", "ಆಧಾರ್", "ಆಧಾರ"],
    "Driving Licence": ["driving licence", "driving license", "licence", "license", "dl", "ड्राइविंग", "लाइसेंस", "ಚಾಲನಾ", "ಡ್ರೈವಿಂಗ್", "ಲೈಸೆನ್ಸ್"],
    "Heavy rain / Flood": ["rain", "heavy rain", "flood", "flooding", "बारिश", "वर्षा", "बाढ़", "ಮಳೆ", "ಪ್ರವಾಹ", "ನೆರೆ"],
    "Drought": ["drought", "no rain", "सूखा", "ಬರ"],
    "Hailstorm": ["hail", "hailstorm", "ओले", "ओलावृष्टि", "ಆಲಿಕಲ್ಲು"],
    "Pest attack": ["pest", "insects", "कीट", "ಕೀಟ"],
    "Paddy": ["paddy", "rice", "धान", "चावल", "ಭತ್ತ"],
    "Ragi": ["ragi", "finger millet", "रागी", "ರಾಗಿ"],
    "Maize": ["maize", "corn", "मक्का", "ಮೆಕ್ಕೆಜೋಳ"],
    "Tur (Red gram)": ["tur", "toor", "red gram", "arhar", "अरहर", "तूर", "ತೊಗರಿ"],
    "Sugarcane": ["sugarcane", "गन्ना", "ಕಬ್ಬು"],
    "Kharif": ["kharif", "monsoon", "खरीफ", "ಮುಂಗಾರು"],
    "Rabi": ["rabi", "winter", "रबी", "ಹಿಂಗಾರು"],
}

# (?![\w\u0900-\u0DFF]) instead of \b: Indic vowel signs are not \w, so \b fails after "हाँ"
_END = r"(?![\w\u0900-\u0DFF])"
YES = r"^\s*(yes|yeah|yep|ok|okay|sure|correct|right|use it|haan|ha|han|हाँ|हां|हा|जी|ठीक|ಹೌದು|ಸರಿ|ಹೂಂ|ಹೂ)" + _END
NO = r"^\s*(no|nope|not|wrong|नहीं|नही|ना|ಇಲ್ಲ|ಬೇಡ)" + _END


def normalize_digits(s: str) -> str:
    return s.translate(DIGIT_MAP)


def _strip_phrases(s: str) -> str:
    s = s.strip().strip(".!")
    for p in LEAD_PHRASES:
        s = re.sub(p, "", s, flags=re.I)
    for p in TRAIL_PHRASES:
        s = re.sub(p, "", s)
    return s.strip().strip(".,!\"'")


def parse_date(s: str, allow_relative: bool = False) -> str | None:
    s = normalize_digits(s.lower().strip())
    if allow_relative:
        if re.search(r"\btoday\b|आज|ಇಂದು", s):
            return date.today().isoformat()
        if re.search(r"\byesterday\b|कल|ನಿನ್ನೆ", s):
            return (date.today() - timedelta(days=1)).isoformat()
        m = re.search(r"(\d+)\s*days?\s*ago", s)
        if m:
            return (date.today() - timedelta(days=int(m.group(1)))).isoformat()
    m = re.search(r"(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if m:
        y, mo, d = map(int, m.groups())
    else:
        m = re.search(r"(\d{1,2})\s*[/\-. ]\s*(\d{1,2})\s*[/\-. ]\s*(\d{4})", s)
        if m:
            d, mo, y = map(int, m.groups())
        else:
            s2 = re.sub(r"(\d)(st|nd|rd|th)\b", r"\1", s)
            for fmt in ("%d %B %Y", "%d %b %Y", "%B %d %Y", "%b %d %Y", "%d %B, %Y", "%B %d, %Y"):
                try:
                    dt = datetime.strptime(re.search(r"[\w ,]+\d{4}", s2).group(0).strip(), fmt)
                    return dt.date().isoformat()
                except Exception:  # noqa: BLE001
                    continue
            return None
    try:
        return date(y, mo, d).isoformat()
    except ValueError:
        return None


def parse_value(field: dict, text: str, values: dict) -> tuple[object | None, str | None]:
    """Returns (value, error_code). error_code is a key into FORMAT hints."""
    raw = normalize_digits(text.strip())
    t = field["type"]
    if t in ("text", "textarea"):
        v = _strip_phrases(raw)
        if len(v) < (5 if t == "textarea" else 2) or not re.search(r"[^\W\d_]", v):
            return None, "text"
        if re.match(YES + r"[\s.!]*$", v.lower()) or re.match(NO + r"[\s.!]*$", v.lower()):
            return None, "text"  # a bare "yes"/"no" is not a name or address
        if field["id"] in ("full_name", "father_name", "taluk", "village") and re.fullmatch(r"[a-zA-Z .]+", v):
            v = " ".join(w.capitalize() for w in v.split())
        return v, None
    if t == "mobile":
        digits = re.sub(r"\D", "", raw)
        if digits.startswith("91") and len(digits) == 12:
            digits = digits[2:]
        if len(digits) == 11 and digits.startswith("0"):
            digits = digits[1:]
        return (digits, None) if re.fullmatch(r"[6-9]\d{9}", digits) else (None, "mobile")
    if t == "date":
        v = parse_date(raw, allow_relative=field["id"] == "damage_date")
        if not v:
            return None, "date"
        if v > date.today().isoformat():
            return None, "date_future"
        return v, None
    if t == "select":
        return match_option(field, raw)
    if t == "id_number":
        kind = values.get(field.get("depends_on") or "")
        if kind == "Aadhaar":
            digits = re.sub(r"\D", "", raw)
            if len(digits) == 16:
                return None, "vid"
            if len(digits) != 12 or digits[0] in "01":
                return None, "aadhaar"
            return f"{digits[:4]} {digits[4:8]} {digits[8:]}", None
        if kind == "Driving Licence":
            v = re.sub(r"[^A-Za-z0-9]", "", raw).upper()
            m = re.fullmatch(r"([A-Z]{2}\d{2})(\d{4})(\d{7})", v)
            if m:
                return f"{m.group(1)} {m.group(2)}{m.group(3)}", None
            return (v, None) if re.fullmatch(r"[A-Z]{2}\d{8,14}", v) else (None, "dl")
        return None, "id_type_first"
    if t == "survey":
        if re.search(r"acre|gunta|hectare|एकड़|ಎಕರೆ|ಗುಂಟೆ", raw, re.I):
            return None, "survey"
        m = re.search(r"\b\d{1,4}(?:\s*/\s*[0-9A-Za-z*]{1,4})*[A-Za-z]?\b", raw)
        if not m:
            return None, "survey"
        return re.sub(r"\s+", "", m.group(0)).upper(), None
    if t == "number":
        low = raw.lower()
        if re.search(r"%|percent|प्रतिशत|ಶೇಕಡ", low):
            return None, "number"
        nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", low)]
        if not nums:
            return None, "number"
        acres = nums[0]
        if re.search(r"hectare|हेक्टेयर|ಹೆಕ್ಟೇರ್", low):
            acres = round(nums[0] * 2.471, 2)
        elif len(nums) > 1 and re.search(r"gunta|गुंटा|ಗುಂಟೆ", low):
            acres = round(nums[0] + nums[1] / 40, 3)
        elif re.search(r"gunta|गुंटा|ಗುಂಟೆ", low) and not re.search(r"acre|एकड़|ಎಕರೆ", low):
            acres = round(nums[0] / 40, 3)
        return (acres, None) if 0 < acres < 1000 else (None, "number")
    if t == "percent":
        nums = re.findall(r"\d+(?:\.\d+)?", raw)
        if re.search(r"\b(half|आधा|ಅರ್ಧ)\b", raw.lower()):
            return 50, None
        if not nums:
            return None, "percent"
        v = float(nums[0])
        return (int(v) if v.is_integer() else v, None) if 0 <= v <= 100 else (None, "percent")
    if t == "account":
        digits = re.sub(r"\D", "", raw)
        return (digits, None) if 9 <= len(digits) <= 18 else (None, "account")
    if t == "ifsc":
        v = re.sub(r"[^A-Za-z0-9]", "", raw).upper()
        v = re.sub(r"^([A-Z]{4})O", r"\g<1>0", v)  # speech often says "O" for zero
        m = re.search(r"[A-Z]{4}0[A-Z0-9]{6}", v)
        return (m.group(0), None) if m else (None, "ifsc")
    if t == "checkbox":
        return None, "declaration_self"
    return raw or None, None if raw else "text"


def match_option(field: dict, text: str) -> tuple[str | None, str | None]:
    low = text.lower().strip()
    opts = field["options"]
    # exact / localized label
    for i, opt in enumerate(opts):
        labels = [opt.lower()] + [ls[i].lower() for ls in (field.get("option_labels") or {}).values() if len(ls) == len(opts)]
        if any(lbl == low for lbl in labels):
            return opt, None
    scores = []
    for i, opt in enumerate(opts):
        cands = [opt.lower()] + [ls[i].lower() for ls in (field.get("option_labels") or {}).values() if len(ls) == len(opts)]
        cands += OPTION_SYNONYMS.get(opt, [])
        best = 0
        for c in cands:
            if re.search(r"[a-z]", c):
                if re.search(r"\b" + re.escape(c) + r"\b", low):
                    best = max(best, len(c))
            elif c in text:
                best = max(best, len(c))
        scores.append((best, opt))
    scores.sort(reverse=True)
    if scores and scores[0][0] > 0 and (len(scores) == 1 or scores[0][0] > scores[1][0]):
        return scores[0][1], None
    return None, "select"


def mask(field: dict, value) -> str:
    if value is None:
        return ""
    s = str(value)
    if field["type"] == "date" and re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        y, m, d = s.split("-")
        return f"{d}/{m}/{y}"
    if isinstance(value, float) and value.is_integer():
        s = str(int(value))
    if field["type"] in ("id_number", "account") and len(re.sub(r"\D", "", s)) >= 8:
        d = re.sub(r"\s", "", s)
        return "•" * (len(d) - 4) + d[-4:]
    return s
