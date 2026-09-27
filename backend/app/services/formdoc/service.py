"""Shared form logic for the API and the assistant: schema/values access, status summary, review, AI notes.

The counts here are the ones the citizen sees. They are computed once, from one status per field, and they
always add up: ``total == completed + skipped + blank + missing + invalid + manual``. Two fields that describe
the same thing (the "pending" and "required_missing" numbers of the old version) cannot drift apart again.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Form, FormField, FormPage, FormValue
from app.models.common import utcnow
from app.services.formdoc import fields as field_schema
from app.services.formdoc.field_hygiene import clean_fields
from app.services.formdoc.values import NON_FILLABLE, is_secret_field, mask, to_display, validate_value

#: The buckets a field can be in. Anything else is a bug, and ``summarize`` would not add up.
STATUSES = ("filled", "blank", "skipped", "missing", "invalid", "manual")
#: A status means the citizen still has to do something about it.
OPEN_STATUSES = ("missing", "skipped", "invalid")


def detector_type(stored_type: str | None, input_type: str | None) -> str:
    """The type the browser, the PDF writer and the validators already speak ("choice", "multiline", "name" …).

    New rows keep it in ``input_type`` and the coarser schema type in ``type``. Rows written before those
    columns existed have ``input_type`` at its migration default ("text") and the detector type in ``type``,
    so "text" is not trusted on its own.
    """
    it = (input_type or "").strip()
    return it if it and it != "text" else (stored_type or "text")


def field_dict(f: FormField) -> dict:
    """A field as every consumer sees it. ``type`` stays in the detector vocabulary (the frontend and old code
    depend on it); the schema type travels alongside as ``schema_type``."""
    dtype = detector_type(f.type, f.input_type)
    return {"field_id": f.field_id, "label": f.label, "normalized_label": f.normalized_label or "", "description": f.description or "",
            "type": dtype, "input_type": dtype, "schema_type": field_schema.norm_type(f.type), "page": f.page, "section": f.section or "",
            "bbox": f.bbox, "label_bbox": f.label_bbox or [], "options": f.options or [], "required": f.required,
            "conditional": bool(f.conditional), "confidence": f.confidence, "source": f.source, "status": f.status or "detected",
            "meta": f.meta or {}, "position": f.position}


def public_field(f: dict) -> dict:
    """Field as sent to the browser (no internal geometry of options beyond what the preview needs)."""
    manual = field_schema.is_manual(f) or f["type"] in NON_FILLABLE or is_secret_field(f)
    keep = ("option_boxes", "multiple", "table", "row", "column", "comb", "layout_guess", "maxlen", "inline_options")
    return {**f, "manual": manual,
            "meta": {k: v for k, v in f["meta"].items() if k in keep},
            "uncertain": (f.get("confidence") or 0) < field_schema.CONF_REVIEW}


def load_fields(db: Session, form: Form) -> list[dict]:
    """Fields the citizen works with: office-use fields, duplicates and review candidates are never asked or filled.

    Candidates (``status='uncertain'``) are kept out of this list on purpose: the citizen confirms them in the
    review panel first, and only accepted candidates join the conversation.
    """
    rows = db.scalars(select(FormField).where(FormField.form_id == form.id, FormField.user_id == form.user_id)
                      .order_by(FormField.position)).all()
    live = [field_dict(r) for r in rows if (r.status or "detected") == "detected"]
    return clean_fields(live)


def load_candidates(db: Session, form: Form) -> list[dict]:
    """Detected-looking labels with no drawn evidence, waiting to be accepted, renamed or rejected."""
    rows = db.scalars(select(FormField).where(FormField.form_id == form.id, FormField.user_id == form.user_id,
                                             FormField.status == "uncertain").order_by(FormField.position)).all()
    return [{"field_id": r.field_id, "label": r.label, "type": detector_type(r.type, r.input_type),
             "input_type": detector_type(r.type, r.input_type), "schema_type": field_schema.norm_type(r.type),
             "page": r.page, "bbox": r.bbox, "options": r.options or [], "confidence": r.confidence,
             "reason": (r.meta or {}).get("rejected") or "no drawn box, line or blank next to it",
             "section": r.section or "", "source": r.source, "position": r.position} for r in rows]


def load_structure(db: Session, form: Form) -> list[dict]:
    """Per-page document structure (title, sections, printed instructions) for answers scoped to this form."""
    pages = db.scalars(select(FormPage).where(FormPage.form_id == form.id, FormPage.user_id == form.user_id)
                       .order_by(FormPage.page_number)).all()
    return [{"page": p.page_number, **(p.structure or {})} for p in pages]


def load_value_rows(db: Session, form: Form) -> dict[str, FormValue]:
    return {r.field_id: r for r in db.scalars(select(FormValue).where(FormValue.form_id == form.id, FormValue.user_id == form.user_id)).all()}


def split_values(rows: dict[str, FormValue]) -> tuple[dict, set[str], set[str]]:
    """(values, skipped_ids, blank_ids). "Not applicable" is a kind of blank: the citizen said the field does
    not apply to them, so the box stays empty and is never asked again. The stored marker keeps which it was."""
    values, skipped, blank = {}, set(), set()
    for fid, r in rows.items():
        v = r.value or {}
        if "v" in v and v["v"] not in (None, "", []):
            values[fid] = v["v"]
        elif v.get("blank") or v.get("not_applicable"):
            blank.add(fid)
        elif v.get("skipped"):
            skipped.add(fid)
    return values, skipped, blank


def field_status(f: dict, values: dict, skipped: set[str], blank: set[str], invalid: set[str] | None = None) -> str:
    """Exactly one bucket per field. Every count in the UI is a count of these."""
    if f["type"] in NON_FILLABLE or field_schema.is_manual(f) or is_secret_field(f):
        return "manual"
    fid = f["field_id"]
    if invalid and fid in invalid:
        return "invalid"
    if fid in values:
        return "filled"
    if fid in blank:
        return "blank"
    if fid in skipped:
        return "skipped"
    return "missing"


def summarize(fields: list[dict], values: dict, skipped: set[str], blank: set[str], clarification: bool = False,
              invalid: set[str] | None = None) -> dict:
    """Counts that always add up, so the header, the review panel and the chat can never disagree.

    ``pending`` is kept for older clients: it is the number of fields the citizen can still act on
    (``missing + skipped + invalid``), never a second, independent denominator.
    """
    st = {f["field_id"]: field_status(f, values, skipped, blank, invalid) for f in fields}
    counts = {s: 0 for s in STATUSES}
    for f in fields:
        counts[st[f["field_id"]]] += 1
    total = len(fields)
    out = {
        "detected": total, "fillable": total - counts["manual"], "status": st,
        "completed": counts["filled"] + counts["blank"],
        "skipped": counts["skipped"], "blank": counts["blank"], "invalid": counts["invalid"],
        "missing": counts["missing"], "manual": counts["manual"], "uncertain": sum(1 for f in fields if public_uncertain(f)),
        "pending": counts["missing"] + counts["skipped"] + counts["invalid"],
        "required_missing": sum(1 for f in fields
                                if f.get("required") and st[f["field_id"]] in ("missing", "skipped", "invalid")),
        "clarification_needed": 1 if clarification else 0,
    }
    assert out["completed"] + out["skipped"] + out["missing"] + out["invalid"] + out["manual"] == total, "counts must add up"
    return out


def public_uncertain(f: dict) -> bool:
    return (f.get("confidence") or 0) < field_schema.CONF_REVIEW


def next_missing(fields: list[dict], values: dict, skipped: set[str], blank: set[str], after: str | None = None,
                 invalid: set[str] | None = None) -> dict | None:
    """The next field the citizen has to answer, in the order the form is printed.

    Two rules, in this order: a field whose condition is not met is not asked (it waits); a field already
    answered is never asked again unless it is invalid. Skipped fields come back around only after every
    unanswered field has been asked once, so "skip" moves on instead of looping.
    """
    ordered = field_schema.reading_order(fields)
    if after:
        idx = next((i for i, f in enumerate(ordered) if f["field_id"] == after), -1)
        if idx >= 0:
            ordered = ordered[idx + 1:] + ordered[:idx + 1]

    def open_now(f: dict) -> bool:
        if not field_schema.field_applies(f, fields, values):
            return False
        return field_status(f, values, skipped, blank, invalid) in ("missing", "invalid")

    for f in ordered:
        if open_now(f):
            return f
    for f in ordered:
        if field_schema.field_applies(f, fields, values) and field_status(f, values, skipped, blank, invalid) == "skipped":
            return f
    return None


def set_value(db: Session, form: Form, fid: str, value, source: str) -> None:
    row = db.scalar(select(FormValue).where(FormValue.form_id == form.id, FormValue.user_id == form.user_id, FormValue.field_id == fid))
    if row is None:
        row = FormValue(form_id=form.id, user_id=form.user_id, field_id=fid)
        db.add(row)
    row.value, row.source, row.updated_at = {"v": value}, source, utcnow()
    db.flush()  # sessions here don't autoflush; later reads in the same request must see the change


def set_marker(db: Session, form: Form, fid: str, marker: str | None) -> None:
    """marker: 'skipped' | 'blank' | 'not_applicable' | None (clear the value)."""
    row = db.scalar(select(FormValue).where(FormValue.form_id == form.id, FormValue.user_id == form.user_id, FormValue.field_id == fid))
    if marker is None:
        if row is not None:
            db.delete(row)
            db.flush()
        return
    if row is None:
        row = FormValue(form_id=form.id, user_id=form.user_id, field_id=fid)
        db.add(row)
    row.value, row.source, row.updated_at = {marker: True}, "user", utcnow()
    db.flush()


def sibling_context(fields: list[dict], values: dict) -> dict:
    """Answers to *other* fields that a value may legitimately refer to (e.g. which ID document was ticked)."""
    return {"choices": [v if isinstance(v, str) else " ".join(v)
                        for f in fields if field_schema.is_choice(f) and (v := values.get(f["field_id"])) is not None]}


def apply_values(db: Session, form: Form, fields: list[dict], incoming: dict, source: str) -> tuple[dict, dict]:
    """Validate and store several values. Returns ({field_id: stored value}, {field_id: error message}).
    An empty string clears the field. One bad value never blocks the others."""
    by_id = {f["field_id"]: f for f in fields}
    rows = load_value_rows(db, form)
    current, _, _ = split_values(rows)
    saved, errors = {}, {}
    # choice fields first so identity-number validation can use the chosen document type
    order = sorted(incoming, key=lambda k: 0 if field_schema.is_choice(by_id.get(k, {})) else 1)
    for fid in order:
        raw = incoming[fid]
        f = by_id.get(fid)
        if f is None:
            errors[fid] = "Unknown field."
            continue
        if raw is None or (isinstance(raw, str) and not raw.strip()) or raw == []:
            set_marker(db, form, fid, None)
            current.pop(fid, None)
            saved[fid] = None
            continue
        try:
            v = validate_value(f, raw, sibling_context(fields, current))
        except ValueError as exc:
            errors[fid] = str(exc)
            continue
        set_value(db, form, fid, v, source)
        current[fid] = v
        saved[fid] = v
    return saved, errors


def review_items(fields: list[dict], values: dict, skipped: set[str], blank: set[str], invalid: set[str] | None = None) -> list[dict]:
    items = []
    for f in fields:
        s = field_status(f, values, skipped, blank, invalid)
        items.append({"field_id": f["field_id"], "label": f["label"], "page": f["page"], "type": f["type"],
                      "input_type": f.get("input_type", f["type"]), "section": f.get("section", ""),
                      "required": f["required"], "conditional": f.get("conditional", False),
                      "confidence": f["confidence"], "status": s,
                      "display": mask(f, values[f["field_id"]]) if s == "filled" else "", "options": f["options"]})
    return items


def ai_notes(form: Form, fields: list[dict], values: dict, skipped: set[str], blank: set[str], pages: list[FormPage],
             clarification: bool, candidates: int = 0) -> dict:
    """Derived from the form's current state on every request; never stored, so it can't overwrite the citizen's notes."""
    sm = summarize(fields, values, skipped, blank, clarification)
    notes: list[str] = []
    for f in fields:
        if field_schema.is_choice(f) and f["field_id"] in values:
            v = values[f["field_id"]]
            notes.append(f"User selected {v if isinstance(v, str) else ', '.join(v)} for “{f['label']}”.")
    manual = [f["label"] for f in fields if sm["status"][f["field_id"]] == "manual"]
    if manual:
        notes.append("To be completed by hand: " + ", ".join(f"“{m}”" for m in manual) + ".")
    if candidates:
        notes.append(f"{candidates} printed label(s) looked like fields but had no box or line to write in, so they were left out.")
    low = [f["label"] for f in fields if public_uncertain(f) and f["type"] not in NON_FILLABLE]
    if low:
        notes.append(f"{len(low)} field(s) were detected with low confidence — please check: " + ", ".join(f"“{m}”" for m in low[:6]) + ".")
    later = [f["label"] for f in fields if sm["status"][f["field_id"]] == "skipped"]
    if later:
        notes.append("Waiting for information: " + ", ".join(f"“{m}”" for m in later[:8]) + ".")
    bad_pages = [p.page_number for p in pages if p.warnings]
    if bad_pages:
        notes.append("Pages that were hard to read: " + ", ".join(map(str, bad_pages)) + ".")
    return {"form": form.original_filename, "detected": sm["detected"], "completed": sm["completed"], "pending": sm["pending"],
            "skipped": sm["skipped"], "candidates": candidates,
            "clarification_needed": sm["clarification_needed"], "notes": notes}
