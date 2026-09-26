"""OCR fallback for screen understanding when no vision model is configured.

The frame is decoded in memory, read, and discarded. Only redacted text leaves this module.
"""
from __future__ import annotations

import base64
import binascii
import io
import logging
import re
from functools import lru_cache

from app.config import settings
from app.services.redact import redact

log = logging.getLogger("ocr")

# Tesseract often reads a radio button "( )" as ")" or "()", and a required "*" as "«".
_REQ = "*«＊"
_OPTION_RE = re.compile(r"^\s*(?:[○◯●◉□☐☑■◻]|\(\s?\)|\)|\[\s?\]|O\s)\s*(.{2,60})$")
_LABEL_RE = re.compile(rf"^\s*(.{{2,60}}?)\s*[{_REQ}]?\s*[:：]\s*[{_REQ}]?\s*(?:_{{2,}}|\[.*\]|\(.*\))?\s*$")
_BLANK_RE = re.compile(rf"^\s*(.{{2,60}}?)\s*[{_REQ}]?\s*(?:_{{3,}}|\[\s*_*\s*\])")
_LANG_CODES = {"en": "eng", "hi": "hin", "kn": "kan"}


@lru_cache
def _installed_languages() -> frozenset[str] | None:
    if not settings.OCR_ENABLED:
        return None
    try:
        import pytesseract

        if settings.TESSERACT_CMD:
            pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
        return frozenset(pytesseract.get_languages(config=""))
    except Exception as exc:  # binary missing or not runnable
        log.info("OCR unavailable: %s", exc)
        return None


def ocr_available() -> bool:
    return bool(_installed_languages())


def _detect(lines: list[str]) -> tuple[list[dict], list[str]]:
    fields, options, seen = [], [], set()
    for line in lines:
        m = _OPTION_RE.match(line)
        if m:
            options.append(m.group(1).strip())
            continue
        m = _LABEL_RE.match(line) or _BLANK_RE.match(line)
        if not m:
            continue
        label = m.group(1).strip(" _" + _REQ)
        key = label.lower()
        if len(label) < 2 or key in seen or not re.search(r"[^\W\d_]", label):
            continue
        seen.add(key)
        fields.append({"label": label, "required": any(c in line for c in _REQ)})
    return fields[:30], options[:30]


def read_screen(frame_b64: str, lang: str = "en") -> dict | None:
    """Returns {visible_text, fields, options} or None when OCR is unavailable or fails."""
    installed = _installed_languages()
    if not installed:
        return None
    try:
        import pytesseract
        from PIL import Image

        img = Image.open(io.BytesIO(base64.b64decode(frame_b64, validate=True))).convert("L")
        wanted = [c for c in ("eng", _LANG_CODES.get(lang, "eng")) if c in installed]
        text = pytesseract.image_to_string(img, lang="+".join(dict.fromkeys(wanted)) or "eng",
                                           config="--psm 6", timeout=20)
    except (binascii.Error, OSError, RuntimeError, ValueError) as exc:
        log.warning("OCR failed: %s", type(exc).__name__)
        return None
    lines = [redact(ln.strip()) for ln in text.splitlines() if ln.strip()]
    fields, options = _detect(lines)
    return {"visible_text": "\n".join(lines)[:3000], "fields": fields, "options": options}
