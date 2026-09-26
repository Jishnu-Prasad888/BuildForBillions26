"""Text with coordinates: PDF text layer (digital pages) or OCR (scanned pages, photos).

A token is ``(x0, y0, x1, y1, text, confidence)`` in the page's coordinate space.
"""
from __future__ import annotations

import logging
import re
import statistics

import numpy as np

from app.services import ocr as ocr_probe

log = logging.getLogger("forms.extract")

Token = tuple[float, float, float, float, str, float | None]


class OcrUnavailable(RuntimeError):
    pass


def pdf_tokens(page) -> list[Token]:
    out: list[Token] = []
    for x0, y0, x1, y1, text, *_ in page.get_text("words"):
        text = text.strip()
        if text:
            out.append((x0, y0, x1, y1, text, None))
    return out


def ocr_tokens(gray: np.ndarray, lang: str = "en") -> tuple[list[Token], float | None]:
    """OCR one page image. Returns (tokens in image pixels, mean confidence 0-100)."""
    installed = ocr_probe._installed_languages()
    if not installed:
        raise OcrUnavailable("OCR engine is not available")
    import pytesseract
    from PIL import Image

    codes = [c for c in ("eng", ocr_probe._LANG_CODES.get(lang, "eng"), "hin", "kan") if c in installed]
    langs = "+".join(dict.fromkeys(codes)) or "eng"
    try:
        d = pytesseract.image_to_data(Image.fromarray(gray), lang=langs, config="--psm 3", output_type=pytesseract.Output.DICT, timeout=90)
    except (RuntimeError, pytesseract.TesseractError) as exc:
        raise OcrUnavailable(f"OCR failed: {type(exc).__name__}") from exc
    tokens: list[Token] = []
    confs: list[float] = []
    for i, text in enumerate(d["text"]):
        text = (text or "").strip()
        try:
            conf = float(d["conf"][i])
        except (TypeError, ValueError):
            conf = -1
        if not text or conf < 0:
            continue
        x, y, w, h = d["left"][i], d["top"][i], d["width"][i], d["height"][i]
        tokens.append((x, y, x + w, y + h, text, conf))
        confs.append(conf)
    return tokens, (statistics.fmean(confs) if confs else None)


def median_height(tokens: list[Token]) -> float:
    hs = [t[3] - t[1] for t in tokens if re.search(r"\w", t[4])]
    return statistics.median(hs) if hs else 0.0


def text_of(tokens: list[Token]) -> str:
    """Reading-order text (rows top to bottom, left to right)."""
    rows = cluster_rows(tokens)
    return "\n".join(" ".join(t[4] for t in row) for row in rows)


def cluster_rows(tokens: list[Token]) -> list[list[Token]]:
    if not tokens:
        return []
    h = median_height(tokens) or 10
    rows: list[list[Token]] = []
    for t in sorted(tokens, key=lambda t: ((t[1] + t[3]) / 2, t[0])):
        cy = (t[1] + t[3]) / 2
        for row in rows:
            rcy = sum((r[1] + r[3]) / 2 for r in row) / len(row)
            if abs(cy - rcy) <= 0.55 * h:
                row.append(t)
                break
        else:
            rows.append([t])
    for row in rows:
        row.sort(key=lambda t: t[0])
    rows.sort(key=lambda r: sum((t[1] + t[3]) / 2 for t in r) / len(r))
    return rows
