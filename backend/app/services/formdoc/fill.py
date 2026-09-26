"""Write the citizen's values onto a COPY of the form and save it as a new PDF.

* Fillable PDFs: the real form fields are set (the page content is untouched).
* Other PDFs: text is overlaid at the detected coordinates; the original page content is kept as-is (no rasterising).
* Photos / images: the corrected page image becomes the background of a one-page PDF, text is overlaid.

The original file is read into memory and never opened for writing. The output is written to a temporary file,
re-opened and checked, and only then moved to ``completed.pdf`` — a failure leaves no partial output behind.
"""
from __future__ import annotations

import logging
import os
import re
from pathlib import Path

from app.config import settings
from app.services.formdoc.values import NON_FILLABLE, to_display

log = logging.getLogger("forms.fill")
IMAGE_PAGE_WIDTH_PT = 595.0  # A4 width; height follows the photo's aspect ratio
_FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/TTF/DejaVuSans.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
    "C:/Windows/Fonts/arial.ttf",
]


class GenerationError(RuntimeError):
    pass


def _unicode_font() -> str | None:
    for p in ([settings.FORM_FONT_PATH] if settings.FORM_FONT_PATH else []) + _FONT_CANDIDATES:
        if p and Path(p).is_file():
            return p
    return None


def _latin(text: str) -> bool:
    try:
        text.encode("cp1252")
        return True
    except UnicodeEncodeError:
        return False


def _fit_text(page, rect, text: str, multiline: bool, fontfile: str | None, fontname: str, rotate: int) -> bool:
    """Insert text into rect, shrinking the font until it fits. Returns False if it could not fit."""
    import fitz

    r = fitz.Rect(rect)
    if page.rotation:
        r = (r * page.derotation_matrix).normalize()
    kw = {"fontname": fontname, "rotate": rotate}
    if fontfile:
        kw["fontfile"] = fontfile
    h_disp = abs(rect[3] - rect[1])
    size = 11.0 if multiline else max(6.0, min(11.0, h_disp * 0.72))
    while size >= 5.5:
        target = fitz.Rect(r)
        if not multiline and not page.rotation:  # keep the text sitting on the line, not floating at the top
            target.y0 = max(r.y0, r.y1 - size * 1.55)
        rc = page.insert_textbox(target, text, fontsize=size, align=0, color=(0.05, 0.1, 0.45), **kw)
        if rc >= 0:
            return True
        size -= 0.5
    return False


def _mark(page, rect, rotate_page: bool) -> None:
    import fitz

    r = fitz.Rect(rect)
    if page.rotation:
        r = (r * page.derotation_matrix).normalize()
    r = fitz.Rect(r.x0 + r.width * 0.18, r.y0 + r.height * 0.18, r.x1 - r.width * 0.18, r.y1 - r.height * 0.18)
    color = (0.05, 0.1, 0.45)
    page.draw_line(r.tl, r.br, color=color, width=1.3)
    page.draw_line(r.tr, r.bl, color=color, width=1.3)


def _fill_widgets(page, fields: list[dict], values: dict) -> set[str]:
    done: set[str] = set()
    by_name: dict[str, list] = {}
    for w in page.widgets() or []:
        by_name.setdefault(w.field_name or "", []).append(w)
    for f in fields:
        name = f["meta"].get("acro_name")
        if f["source"] != "acroform" or name not in by_name or f["field_id"] not in values:
            continue
        v = values[f["field_id"]]
        widgets = by_name[name]
        acro_type = f["meta"].get("acro_type")
        if acro_type == "RadioButton":
            states = f["options"]
            for w, st in zip(widgets, states):
                w.field_value = st == v
                w.update()
        elif acro_type == "CheckBox":
            widgets[0].field_value = bool(v)
            widgets[0].update()
        else:
            w = widgets[0]
            maxlen = f["meta"].get("maxlen")
            text = to_display(f, v)
            w.field_value = text[:maxlen] if maxlen else text
            w.update()
        done.add(f["field_id"])
    return done


def generate_pdf(original_bytes: bytes, kind: str, page_image_paths: dict[int, Path], pages: dict[int, tuple[float, float]],
                 fields: list[dict], values: dict, out_path: Path) -> list[str]:
    """``fields``: dicts with field_id,label,type,page,bbox,options,source,meta. ``values``: field_id -> stored value.
    Returns warnings (strings meant for the citizen). Raises GenerationError; never leaves a partial file."""
    import fitz

    warnings: list[str] = []
    font_file = _unicode_font()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = out_path.with_name(f".{out_path.name}.tmp")
    tmp.unlink(missing_ok=True)
    try:
        if kind == "pdf":
            doc = fitz.open(stream=original_bytes, filetype="pdf")
            expected_pages = doc.page_count
        else:
            doc = fitz.open()
            expected_pages = 1
            pw, ph = pages[1]
            scale = IMAGE_PAGE_WIDTH_PT / pw
            page = doc.new_page(width=IMAGE_PAGE_WIDTH_PT, height=ph * scale)
            page.insert_image(page.rect, filename=str(page_image_paths[1]))
        try:
            for pno in range(doc.page_count):
                page = doc[pno]
                on_page = [f for f in fields if f["page"] == pno + 1 and f["field_id"] in values and f["type"] not in NON_FILLABLE]
                if not on_page:
                    continue
                handled = _fill_widgets(page, on_page, values) if kind == "pdf" else set()
                s = 1.0 if kind == "pdf" else IMAGE_PAGE_WIDTH_PT / pages[1][0]
                for f in on_page:
                    if f["field_id"] in handled:
                        continue
                    v = values[f["field_id"]]
                    bbox = [c * s for c in f["bbox"]]
                    if f["type"] == "choice":
                        boxes = f["meta"].get("option_boxes") or []
                        chosen = v if isinstance(v, list) else [v]
                        for opt in chosen:
                            if opt in f["options"] and f["options"].index(opt) < len(boxes):
                                _mark(page, [c * s for c in boxes[f["options"].index(opt)]], False)
                            else:
                                warnings.append(f"“{f['label']}”: I couldn't find where to mark “{opt}”. Please mark it by hand.")
                        continue
                    if f["type"] == "checkbox":
                        if v:
                            boxes = f["meta"].get("option_boxes") or [bbox]
                            _mark(page, [c * s for c in boxes[0]], False)
                        continue
                    text = to_display(f, v)
                    if not text:
                        continue
                    use_font, fname = None, "helv"
                    if not _latin(text):
                        if not font_file:
                            warnings.append(f"“{f['label']}”: I couldn't write this text because no font for its script is installed on the server.")
                            continue
                        use_font, fname = font_file, "unifont"
                    multiline = f["type"] == "multiline" or (bbox[3] - bbox[1]) > 26 * max(s, 1e-6) and len(text) > 30
                    if not _fit_text(page, bbox, text, multiline, use_font, fname, page.rotation):
                        warnings.append(f"“{f['label']}”: the text is too long for the space on the form and was not written. Shorten it or write it by hand.")
            doc.save(str(tmp), garbage=3, deflate=True)
        finally:
            doc.close()
        check = fitz.open(str(tmp))
        try:
            if check.page_count != expected_pages:
                raise GenerationError("page count changed")
            for p in check:  # every page must still parse
                p.get_text()
        finally:
            check.close()
        if tmp.stat().st_size < 200:
            raise GenerationError("output too small")
        os.replace(tmp, out_path)
        return warnings
    except GenerationError:
        raise
    except Exception as exc:  # noqa: BLE001
        log.error("PDF generation failed: %s", type(exc).__name__)
        raise GenerationError(type(exc).__name__) from exc
    finally:
        tmp.unlink(missing_ok=True)
