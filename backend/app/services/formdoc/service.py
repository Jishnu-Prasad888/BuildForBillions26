"""Shared form logic for the API and the assistant: schema/values access, status summary, review, AI notes."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Form, FormField, FormPage, FormValue
from app.models.common import utcnow
from app.services.formdoc.values import NON_FILLABLE, is_secret_field, mask, to_display, validate_value


def field_dict(f: FormField) -> dict:
    return {"field_id": f.field_id, "label": f.label, "description": f.description or "", "type": f.type, "page": f.page,
            "bbox": f.bbox, "options": f.options or [], "required": f.required, "confidence": f.confidence, "source": f.source,
            "meta": f.meta or {}, "position": f.position}


def public_field(f: dict) -> dict:
    """Field as sent to the browser (no internal geometry of options beyond what the preview needs)."""
    manual = f["type"] in NON_FILLABLE or is_secret_field(f)
    return {**f, "manual": manual, "meta": {k: v for k, v in f["meta"].items() if k in ("option_boxes", "multiple", "table", "row", "column", "comb", "layout_guess", "maxlen")}}


def load_fields(db: Session, form: Form) -> list[dict]:
    rows = db.scalars(select(FormField).where(FormField.form_id == form.id, FormField.user_id == form.user_id).order_by(FormField.position)).all()
    return [field_dict(r) for r in rows]


def load_value_rows(db: Session, form: Form) -> dict[str, FormValue]:
    return {r.field_id: r for r in db.scalars(select(FormValue).where(FormValue.form_id == form.id, FormValue.user_id == form.user_id)).all()}


def split_values(rows: dict[str, FormValue]) -> tuple[dict, set[str], set[str]]:
    """(values, skipped_ids, blank_ids)."""
    values, skipped, blank = {}, set(), set()
    for fid, r in rows.items():
        v = r.value or {}
        if "v" in v and v["v"] not in (None, "", []):
            values[fid] = v["v"]
        elif v.get("blank"):
            blank.add(fid)
        elif v.get("skipped"):
            skipped.add(fid)
    return values, skipped, blank


def field_status(f: dict, values: dict, skipped: set[str], blank: set[str]) -> str:
    if f["type"] in NON_FILLABLE or is_secret_field(f):
        return "manual"
    if f["field_id"] in values:
        return "filled"
    if f["field_id"] in blank:
        return "blank"
    if f["field_id"] in skipped:
        return "skipped"
    return "missing"


def summarize(fields: list[dict], values: dict, skipped: set[str], blank: set[str], clarification: bool = False) -> dict:
    st = {f["field_id"]: field_status(f, values, skipped, blank) for f in fields}
    fillable = [f for f in fields if st[f["field_id"]] != "manual"]
    done = sum(1 for f in fillable if st[f["field_id"]] in ("filled", "blank"))
    return {"detected": len(fields), "fillable": len(fillable), "completed": done, "pending": len(fillable) - done,
            "required_missing": sum(1 for f in fillable if f["required"] and st[f["field_id"]] in ("missing", "skipped")),
            "clarification_needed": 1 if clarification else 0, "status": st}


def next_missing(fields: list[dict], values: dict, skipped: set[str], blank: set[str], after: str | None = None) -> dict | None:
    """Next field that needs information: never-asked fields first (after the given one), then the skipped ones."""
    ordered = fields
    if after:
        idx = next((i for i, f in enumerate(fields) if f["field_id"] == after), -1)
        ordered = fields[idx + 1:] + fields[:idx + 1]
    for pool in ("missing", "skipped"):
        for f in ordered:
            if field_status(f, values, skipped, blank) == pool:
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
    """marker: 'skipped' | 'blank' | None (clear the value)."""
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
    return {"choices": [v if isinstance(v, str) else " ".join(v) for f in fields if f["type"] == "choice" and (v := values.get(f["field_id"])) is not None]}


def apply_values(db: Session, form: Form, fields: list[dict], incoming: dict, source: str) -> tuple[dict, dict]:
    """Validate and store several values. Returns ({field_id: stored value}, {field_id: error message}).
    An empty string clears the field. One bad value never blocks the others."""
    by_id = {f["field_id"]: f for f in fields}
    rows = load_value_rows(db, form)
    current, _, _ = split_values(rows)
    saved, errors = {}, {}
    # choice fields first so identity-number validation can use the chosen document type
    order = sorted(incoming, key=lambda k: 0 if by_id.get(k, {}).get("type") == "choice" else 1)
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


def review_items(fields: list[dict], values: dict, skipped: set[str], blank: set[str]) -> list[dict]:
    items = []
    for f in fields:
        s = field_status(f, values, skipped, blank)
        items.append({"field_id": f["field_id"], "label": f["label"], "page": f["page"], "type": f["type"], "required": f["required"], "status": s,
                      "display": mask(f, values[f["field_id"]]) if s == "filled" else "", "options": f["options"]})
    return items


def ai_notes(form: Form, fields: list[dict], values: dict, skipped: set[str], blank: set[str], pages: list[FormPage], clarification: bool) -> dict:
    """Derived from the form's current state on every request; never stored, so it can't overwrite the citizen's notes."""
    sm = summarize(fields, values, skipped, blank, clarification)
    notes: list[str] = []
    for f in fields:
        if f["type"] == "choice" and f["field_id"] in values:
            v = values[f["field_id"]]
            notes.append(f"User selected {v if isinstance(v, str) else ', '.join(v)} for “{f['label']}”.")
    manual = [f["label"] for f in fields if sm["status"][f["field_id"]] == "manual"]
    if manual:
        notes.append("To be completed by hand: " + ", ".join(f"“{m}”" for m in manual) + ".")
    low = [f["label"] for f in fields if f["confidence"] < 0.6 and f["type"] not in NON_FILLABLE]
    if low:
        notes.append(f"{len(low)} field(s) were detected with low confidence — please check: " + ", ".join(f"“{m}”" for m in low[:6]) + ".")
    later = [f["label"] for f in fields if sm["status"][f["field_id"]] == "skipped"]
    if later:
        notes.append("Waiting for information: " + ", ".join(f"“{m}”" for m in later[:8]) + ".")
    bad_pages = [p.page_number for p in pages if p.warnings]
    if bad_pages:
        notes.append("Pages that were hard to read: " + ", ".join(map(str, bad_pages)) + ".")
    return {"form": form.original_filename, "detected": sm["detected"], "completed": sm["completed"], "pending": sm["pending"],
            "clarification_needed": sm["clarification_needed"], "notes": notes}
