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
from app.services.formdoc.block_letters import apply_block_letters
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


_INK = (0.05, 0.1, 0.45)


def _text_width(text: str, size: float, fontname: str, fontfile: str | None) -> float:
    import fitz

    if fontfile:
        return fitz.Font(fontfile=fontfile).text_length(text, fontsize=size)
    return fitz.get_text_length(text, fontname=fontname, fontsize=size)


def _write_line(page, r, text: str, fontfile: str | None, fontname: str) -> bool:
    """One line sitting on the bottom of the field, shrunk until it fits the WIDTH. Returns False if it can't.

    Only the width decides. insert_textbox also insists on a box about 1.7x the font size tall, and the value boxes of real
    forms are 10-12pt, so it rejected every value and the PDF came out unchanged.
    """
    size = max(6.0, min(11.0, r.height * 0.72))
    while size >= 5.5 and _text_width(text, size, fontname, fontfile) > r.width:
        size -= 0.5
    if size < 5.5:
        return False
    kw = {"fontfile": fontfile} if fontfile else {}
    page.insert_text((r.x0 + 1, r.y1 - min(r.height * 0.28, 4.0)), text, fontsize=size, fontname=fontname, color=_INK, **kw)
    return True


def _fit_text(page, rect, text: str, multiline: bool, fontfile: str | None, fontname: str, rotate: int) -> bool:
    """Write text into rect. Returns False if it could not fit (the caller warns the citizen)."""
    import fitz

    r = fitz.Rect(rect)
    if page.rotation:
        r = (r * page.derotation_matrix).normalize()
    if not multiline and not page.rotation:
        return _write_line(page, r, text, fontfile, fontname)
    kw = {"fontname": fontname, "rotate": rotate}
    if fontfile:
        kw["fontfile"] = fontfile
    size = 11.0 if multiline else max(6.0, min(11.0, abs(rect[3] - rect[1]) * 0.72))
    while size >= 5.5:
        rc = page.insert_textbox(fitz.Rect(r), text, fontsize=size, align=0, color=_INK, **kw)
        if rc >= 0:
            return True
        size -= 0.5
    if multiline and not page.rotation:  # the box is a single ruled line, too short to wrap in: write one shrunk line instead
        return _write_line(page, r, text, fontfile, fontname)
    return False


# Noto families per script. Devanagari/Kannada need shaping (vowel signs, conjuncts), which insert_textbox doesn't do,
# so they are drawn with insert_htmlbox. MuPDF falls back to its built-in Noto fonts if these files are missing.
_NOTO_DIRS = ["/usr/share/fonts/truetype/noto", "/usr/share/fonts/noto", "/usr/local/share/fonts/noto"]
_SCRIPT_FONT = {"deva": "NotoSansDevanagari-Regular.ttf", "knda": "NotoSansKannada-Regular.ttf", "latn": "NotoSans-Regular.ttf"}


def _script(text: str) -> str:
    """Dominant script of a value: 'deva' (Hindi), 'knda' (Kannada) or 'latn'."""
    deva = sum(1 for ch in text if "ऀ" <= ch <= "ॿ")
    knda = sum(1 for ch in text if "ಀ" <= ch <= "೿")
    if not deva and not knda:
        return "latn"
    return "deva" if deva >= knda else "knda"


def _noto_dir() -> str | None:
    dirs = ([str(Path(settings.FORM_FONT_PATH).parent)] if settings.FORM_FONT_PATH else []) + _NOTO_DIRS
    for d in dirs:
        if Path(d, _SCRIPT_FONT["deva"]).is_file() or Path(d, _SCRIPT_FONT["knda"]).is_file():
            return d
    return None


def _fit_indic(page, rect, text: str, multiline: bool, script: str) -> bool:
    """Shaped text for Hindi/Kannada, shrunk to fit. Returns False if it could not fit."""
    import fitz

    r = fitz.Rect(rect)
    if page.rotation:
        r = (r * page.derotation_matrix).normalize()
    size = 11.0 if multiline else max(6.0, min(11.0, abs(rect[3] - rect[1]) * 0.72))
    font_dir = _noto_dir()
    faces = "".join(f"@font-face {{font-family: {k}; src: url({v});}}" for k, v in _SCRIPT_FONT.items()
                    if font_dir and Path(font_dir, v).is_file())
    css = faces + f"body {{font-family: {script}, latn; font-size: {size}px; line-height: 1.15; margin: 0; color: rgb(13, 26, 115);}}"
    if not multiline and not page.rotation:  # sit on the line like the Latin text does
        r.y0 = max(r.y0, r.y1 - size * 1.6)
    kw = {"archive": fitz.Archive(font_dir)} if font_dir else {}
    spare, _scale = page.insert_htmlbox(r, text, css=css, scale_low=0.45, rotate=page.rotation, **kw)
    return spare >= 0


def _mark(page, rect, rotate_page: bool) -> None:
    import fitz

    r = fitz.Rect(rect)
    if page.rotation:
        r = (r * page.derotation_matrix).normalize()
    r = fitz.Rect(r.x0 + r.width * 0.18, r.y0 + r.height * 0.18, r.x1 - r.width * 0.18, r.y1 - r.height * 0.18)
    color = (0.05, 0.1, 0.45)
    page.draw_line(r.tl, r.br, color=color, width=1.3)
    page.draw_line(r.tr, r.bl, color=color, width=1.3)


def _display(field: dict, value, block_letters: bool) -> str:
    text = to_display(field, value)
    return apply_block_letters(field["type"], text) if block_letters else text


def _fill_widgets(page, fields: list[dict], values: dict, block_letters: bool = False) -> set[str]:
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
            text = _display(f, v, block_letters)
            if _script(text) != "latn":
                # Form-field appearances can only use Latin base fonts, so Hindi/Kannada would be invisible. Flatten this
                # one field: remove the widget and let the caller draw shaped text in its place.
                log.info("Flattening a form field to write non-Latin text (page %s)", f["page"])
                page.delete_widget(w)
                continue
            w.field_value = text[:maxlen] if maxlen else text
            w.update()
        done.add(f["field_id"])
    return done


def generate_pdf(original_bytes: bytes, kind: str, page_image_paths: dict[int, Path], pages: dict[int, tuple[float, float]],
                 fields: list[dict], values: dict, out_path: Path, block_letters: bool = False) -> list[str]:
    """``fields``: dicts with field_id,label,type,page,bbox,options,source,meta. ``values``: field_id -> stored value.
    ``block_letters``: write text values in capitals (emails excepted).
    Returns warnings (strings meant for the citizen). Raises GenerationError; never leaves a partial file."""
    import fitz

    warnings: list[str] = []
    written: list[tuple[int, dict, str]] = []  # (page index, field, text) drawn by us in Latin script, checked after saving
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
                handled = _fill_widgets(page, on_page, values, block_letters) if kind == "pdf" else set()
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
                    text = _display(f, v, block_letters)
                    if not text:
                        continue
                    multiline = f["type"] == "multiline" or (bbox[3] - bbox[1]) > 26 * max(s, 1e-6) and len(text) > 30
                    script = _script(text)
                    if script != "latn":
                        ok = _fit_indic(page, bbox, text, multiline, script)
                    else:
                        use_font, fname = (None, "helv") if _latin(text) else (font_file, "unifont")
                        if fname == "unifont" and not font_file:
                            ok = _fit_indic(page, bbox, text, multiline, "latn")  # accents etc. outside cp1252
                        else:
                            ok = _fit_text(page, bbox, text, multiline, use_font, fname, page.rotation)
                    if not ok:
                        log.warning("Value for field %s did not fit its box on page %s", f["field_id"], f["page"])
                        warnings.append(f"“{f['label']}”: the text is too long for the space on the form and was not written. Shorten it or write it by hand.")
                    elif script == "latn":
                        written.append((pno, f, text))
            doc.save(str(tmp), garbage=3, deflate=True)
        finally:
            doc.close()
        check = fitz.open(str(tmp))
        try:
            if check.page_count != expected_pages:
                raise GenerationError("page count changed")
            page_text = {}
            for pno, p in enumerate(check):  # every page must still parse
                page_text[pno] = re.sub(r"\s+", "", p.get_text()).lower()
            for pno, f, text in written:  # nothing may be silently dropped: each value we drew must be readable on its page
                if re.sub(r"\s+", "", text).lower()[:12] not in page_text.get(pno, ""):
                    log.warning("Value for field %s was drawn but is not readable on page %s", f["field_id"], pno + 1)
                    warnings.append(f"“{f['label']}”: I couldn't confirm this value on the PDF. Please check it on the completed form.")
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
