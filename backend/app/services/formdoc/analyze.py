"""Form analysis pipeline: original bytes -> page images, text with coordinates, detected fields -> schema in the database.

The original file is only ever read. All derived files go to processed/.
"""
from __future__ import annotations

import logging
import re

import cv2
import numpy as np
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Form, FormField, FormPage, FormValue
from app.models.common import utcnow
from app.services.formdoc import detect, extract, imaging, storage
from app.services.formdoc.detect import TYPES, infer_type, is_required
from app.services.redact import redact

log = logging.getLogger("forms.analyze")

RENDER_DPI = 170
OCR_MSG = "I couldn't read this page clearly. Please upload a clearer image or try taking another photo."


class AnalysisFailed(RuntimeError):
    pass


def _prettify(name: str) -> str:
    s = re.sub(r"([a-z])([A-Z])", r"\1 \2", name)
    return re.sub(r"[_\.\[\]\-]+", " ", s).strip().title()


# --------------------------------------------------------------------------- fillable (AcroForm) fields
def _widget_fields(page, tokens, h) -> list[dict]:
    import fitz

    if page.rotation:
        return []
    fields: list[dict] = []
    radios: dict[str, dict] = {}
    for w in page.widgets() or []:
        ftype = w.field_type_string
        name = w.field_name or ""
        rect = [w.rect.x0, w.rect.y0, w.rect.x1, w.rect.y1]
        if ftype == "Button":
            continue
        label = (getattr(w, "field_label", "") or "").strip()
        if not label:  # nearest text to the left on the same row, else just above
            cy = (rect[1] + rect[3]) / 2
            left = [t for t in tokens if t[2] <= rect[0] + 2 and abs((t[1] + t[3]) / 2 - cy) <= max(h, (rect[3] - rect[1]) / 2)]
            if left:
                row = sorted([t for t in left if rect[0] - t[2] < 25 * h], key=lambda t: t[0])
                label = " ".join(t[4] for t in row[-6:])
            if not label:
                above = [t for t in tokens if 0 <= rect[1] - t[3] <= 2.2 * h and t[0] <= rect[2] and t[2] >= rect[0] - 4 * h]
                label = " ".join(t[4] for t in sorted(above, key=lambda t: t[0])[:8])
        label = detect.clean_label(label) or _prettify(name)
        if ftype == "RadioButton":
            try:
                state = w.on_state()
            except Exception:  # noqa: BLE001
                state = None
            g = radios.setdefault(name, {"label": label, "rects": [], "states": [], "page_rects": []})
            g["rects"].append(rect)
            g["states"].append(str(state) if state not in (None, True, False) else f"Option {len(g['states']) + 1}")
            continue
        base = {"label": label, "page_bbox": rect, "confidence": 0.98, "source": "acroform", "description": "",
                "meta": {"acro_name": name, "acro_type": ftype}, "options": []}
        if ftype == "CheckBox":
            fields.append({**base, "type": "checkbox", "required": is_required(label, "checkbox")})
        elif ftype in ("ComboBox", "ListBox"):
            opts = [c[1] if isinstance(c, (list, tuple)) else str(c) for c in (w.choice_values or [])]
            fields.append({**base, "type": "choice", "options": [str(o) for o in opts], "required": is_required(label, "choice")})
        elif ftype == "Signature":
            fields.append({**base, "type": "signature", "required": False})
        else:
            multiline = bool(w.field_flags & 4096)
            t = infer_type(label, "multiline" if multiline else "text")
            if multiline and t in ("text", "name"):
                t = "multiline"
            if w.text_maxlen:
                base["meta"]["maxlen"] = int(w.text_maxlen)
            fields.append({**base, "type": t, "required": is_required(label, t)})
    for name, g in radios.items():
        bb = [min(r[0] for r in g["rects"]), min(r[1] for r in g["rects"]), max(r[2] for r in g["rects"]), max(r[3] for r in g["rects"])]
        fields.append({"label": g["label"], "type": "choice", "page_bbox": bb, "confidence": 0.98, "source": "acroform", "description": "",
                       "options": g["states"], "required": True,
                       "meta": {"acro_name": name, "acro_type": "RadioButton", "option_boxes": g["rects"]}})
    return fields


# --------------------------------------------------------------------------- LLM refinement (labels only, no values)
def _refine_with_llm(fields: list[dict]) -> None:
    """Ask the LLM to correct the *type* and *required* flag of detected fields. It cannot add, remove or rename
    fields, and only labels (never values) are sent."""
    if not settings.FORM_LLM_ENABLED or not fields:
        return
    from app.services.ai import get_ai

    cands = [f for f in fields if f["source"] != "acroform" and f["type"] in ("text", "name") and f["confidence"] < 0.95][:60]
    if not cands:
        return
    listing = [{"id": f["_id"], "label": redact(f["label"]), "current_type": f["type"]} for f in cands]
    try:
        res = get_ai().generate_json([
            {"role": "system", "content": "You classify form fields from their printed labels. Answer JSON only."},
            {"role": "user", "content": "For each field give the best type from: " + ", ".join(sorted(TYPES - {"choice", "checkbox"})) +
             ". Use the current type if unsure. Do not add or rename fields.\n"
             "Reply as {\"fields\": [{\"id\": \"...\", \"type\": \"...\"}]}.\nFields: " + str(listing)},
        ])
    except Exception as exc:  # noqa: BLE001
        log.info("LLM refinement skipped: %s", type(exc).__name__)
        return
    if not res or not isinstance(res.get("fields"), list):
        return
    by_id = {f["_id"]: f for f in cands}
    for item in res["fields"]:
        f = by_id.get(item.get("id")) if isinstance(item, dict) else None
        t = item.get("type") if isinstance(item, dict) else None
        if f is not None and isinstance(t, str) and t in TYPES and t not in ("choice", "checkbox"):
            f["type"] = t
            f["required"] = is_required(f["label"], t)


# --------------------------------------------------------------------------- pipeline
def _lang_hint(db: Session, user_id: str) -> str:
    from app.models import User

    u = db.get(User, user_id)
    return (u.preferred_language if u else "en") or "en"


def analyze_form(db: Session, form: Form) -> None:
    """Runs the whole pipeline and stores pages/fields. Sets form.status to READY or FAILED. Never raises for bad content."""
    uid, fid = form.user_id, form.id
    try:
        src = storage.original_path(uid, fid, form.stored_filename)
        data = src.read_bytes()
        import hashlib

        if hashlib.sha256(data).hexdigest() != form.sha256:
            raise AnalysisFailed("The stored file no longer matches the upload. Please upload it again.")
        storage.processed_dir(uid, fid).mkdir(parents=True, exist_ok=True)
        lang = _lang_hint(db, uid)
        pages = _analyze_pdf(data, uid, fid, lang) if form.kind == "pdf" else _analyze_image(data, uid, fid, lang)
        if not pages or all(p["unreadable"] and not p["fields"] for p in pages):
            raise AnalysisFailed(OCR_MSG)

        all_fields = []
        for p in pages:
            for f in p["fields"]:
                f["page"] = p["number"]
                all_fields.append(f)
        for i, f in enumerate(all_fields, start=1):
            f["_id"] = f"field_{i:03d}"
        _refine_with_llm(all_fields)

        db.execute(delete(FormValue).where(FormValue.form_id == fid, FormValue.user_id == uid))
        db.execute(delete(FormField).where(FormField.form_id == fid, FormField.user_id == uid))
        db.execute(delete(FormPage).where(FormPage.form_id == fid, FormPage.user_id == uid))
        for p in pages:
            db.add(FormPage(form_id=fid, user_id=uid, page_number=p["number"], width=p["width"], height=p["height"], text_source=p["source"],
                            ocr_confidence=p["conf"], extracted_text=p["text"][:60000], blocks=p["blocks"][:1500], warnings=p["warnings"]))
        for pos, f in enumerate(all_fields):
            db.add(FormField(form_id=fid, user_id=uid, field_id=f["_id"], label=f["label"], description=f.get("description", ""), type=f["type"],
                             page=f["page"], bbox=f["page_bbox"], options=f.get("options", []), required=f["required"],
                             confidence=f["confidence"], source=f["source"], meta=f.get("meta", {}), position=pos))
        form.page_count = len(pages)
        form.analysis = {
            "fillable": any(f["source"] == "acroform" for f in all_fields),
            "ocr_pages": [p["number"] for p in pages if p["source"] == "ocr"],
            "unreadable_pages": [p["number"] for p in pages if p["unreadable"]],
            "field_count": len(all_fields),
            "warnings": sorted({w for p in pages for w in p["warnings"]}),
            "photo": pages[0].get("photo") if form.kind == "image" else None,
        }
        form.status = "READY"
        form.error = None
    except AnalysisFailed as exc:
        db.rollback()
        _mark_failed(db, form, str(exc))
    except Exception as exc:  # noqa: BLE001 - a bad document must never crash the worker or touch the original
        db.rollback()
        log.exception("Form analysis failed (%s)", type(exc).__name__)
        _mark_failed(db, form, "I couldn't analyse this form. Your original file has not been modified. Try a clearer copy.")
    else:
        db.commit()


def _mark_failed(db: Session, form: Form, message: str) -> None:
    f = db.get(Form, form.id)
    if f is not None:
        f.status = "FAILED"
        f.error = message
        db.commit()


def _page_record(number, width, height, source, conf, tokens, tokens_scale, geometry, geom_scale, widget_fields, extra_warnings) -> dict:
    """``tokens_scale`` / ``geom_scale`` convert the tokens / the pixel geometry into the page's coordinate space."""
    ts, gs = tokens_scale, geom_scale
    tokens_u = [(x0 * ts, y0 * ts, x1 * ts, y1 * ts, t, c) for x0, y0, x1, y1, t, c in tokens]
    hlines = [(a * gs, b * gs, y * gs) for a, b, y in geometry["hlines"]]
    rects = [(a * gs, b * gs, c * gs, d * gs) for a, b, c, d in geometry["boxes"]]
    existing = [f["page_bbox"] for f in widget_fields]
    st = detect.detect_page(tokens_u, hlines, rects, width, height, existing)
    warnings = list(extra_warnings)
    if not tokens_u and not widget_fields:
        warnings.append("ocr_unclear")
    return {"number": number, "width": round(width, 2), "height": round(height, 2), "source": source, "conf": conf,
            "text": extract.text_of(tokens_u), "unreadable": (not tokens_u and not widget_fields),
            "blocks": [{"text": t[4], "bbox": [round(t[0], 1), round(t[1], 1), round(t[2], 1), round(t[3], 1)],
                        "confidence": None if t[5] is None else round(t[5], 1)} for t in tokens_u],
            "fields": widget_fields + st.fields, "warnings": warnings}


def _analyze_pdf(data: bytes, uid: str, fid: str, lang: str) -> list[dict]:
    import fitz

    doc = fitz.open(stream=data, filetype="pdf")  # from memory: the file on disk is never opened for writing
    pages: list[dict] = []
    try:
        for i, page in enumerate(doc, start=1):
            scale = 72.0 / RENDER_DPI
            pix = page.get_pixmap(dpi=RENDER_DPI, alpha=False)
            rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
            bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
            storage.page_image_path(uid, fid, i).write_bytes(imaging.to_png(bgr))
            gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

            tokens = extract.pdf_tokens(page)
            if page.rotation and tokens:
                m = page.rotation_matrix  # words are reported unrotated; move them to the orientation shown on screen
                tokens = [(*tuple(fitz.Rect(t[:4]).transform(m)), t[4], t[5]) for t in tokens]
            chars = sum(len(t[4]) for t in tokens)
            img_area = 0.0
            try:
                for info in page.get_image_info():
                    r = fitz.Rect(info["bbox"]) & page.rect
                    img_area += max(0.0, r.width * r.height)
            except Exception:  # noqa: BLE001
                pass
            covered = img_area / max(page.rect.width * page.rect.height, 1)
            source, conf, warnings = "pdf", None, []
            scan_like = chars < 30 or (covered > 0.6 and chars < 150)
            tokens_px = None
            if scan_like:
                try:
                    ocr_tokens, conf = extract.ocr_tokens(gray, lang)
                    if len(ocr_tokens) > len(tokens):
                        tokens_px, source = ocr_tokens, "ocr"
                        if conf is not None and conf < 45:
                            warnings.append("ocr_low_confidence")
                except extract.OcrUnavailable as exc:
                    log.info("OCR unavailable for page %d: %s", i, exc)
                    warnings.append("ocr_unavailable")
            widget_fields = _widget_fields(page, tokens, extract.median_height(tokens) or 10)
            geometry = imaging.detect_geometry(gray)
            if tokens_px is not None:  # OCR reads pixels; digital text is already in points
                pages.append(_page_record(i, page.rect.width, page.rect.height, source, conf, tokens_px, scale, geometry, scale, widget_fields, warnings))
            else:
                pages.append(_page_record(i, page.rect.width, page.rect.height, source, conf, tokens, 1.0, geometry, scale, widget_fields, warnings))
    finally:
        doc.close()
    return pages


def _analyze_image(data: bytes, uid: str, fid: str, lang: str) -> list[dict]:
    img, info = imaging.prepare_photo(data)
    storage.page_image_path(uid, fid, 1).write_bytes(imaging.to_png(img))
    h, w = img.shape[:2]
    gray = imaging.enhance_for_ocr(img, photo=True)
    warnings: list[str] = []
    tokens: list = []
    conf = None
    try:
        tokens, conf = extract.ocr_tokens(gray, lang)
        if conf is not None and conf < 45:
            warnings.append("ocr_low_confidence")
    except extract.OcrUnavailable as exc:
        log.info("OCR unavailable: %s", exc)
        warnings.append("ocr_unavailable")
    geometry = imaging.detect_geometry(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY))
    rec = _page_record(1, w, h, "ocr", conf, tokens, 1.0, geometry, 1.0, [], warnings)
    rec["photo"] = info
    return [rec]
