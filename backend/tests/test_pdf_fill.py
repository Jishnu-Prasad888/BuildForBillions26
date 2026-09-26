"""PDF filling (FORMBOT_FIX_PLAYBOOK.md Prompt 3): every saved value is visible on the right page, in any script.

Rendered pages are written to tests/output/ for eyeballing (git-ignored). Text read back from a PDF can't be trusted
for shaped Indic glyphs (vowel signs and conjuncts extract as junk), so the read-back values avoid those; the PNGs
show the shaped words.
"""
from pathlib import Path

import fitz
import pytest

from app.services.formdoc.fill import _script
from tests.make_forms import kcc_form_pdf, sample_form_pdf
from tests.test_forms import ready_form, schema

OUT = Path(__file__).parent / "output"


def fill_and_download(client, user, pdf: bytes, name: str, values_by_label: dict) -> tuple[bytes, list[str], dict]:
    fid = ready_form(client, user, pdf, name)
    sch = schema(client, user, fid)
    ids = {f["label"]: f["field_id"] for f in sch["fields"]}
    r = client.post(f"/api/forms/{fid}/autofill", headers=user["headers"], json={"values": {ids[k]: v for k, v in values_by_label.items()}})
    assert r.status_code == 200 and not r.json()["errors"], r.text
    missing = [f["field_id"] for f in client.get(f"/api/forms/{fid}/review", headers=user["headers"]).json()["missing"]]
    g = client.post(f"/api/forms/{fid}/generate", headers=user["headers"], json={"allow_blank": missing})
    assert g.status_code == 200, g.text
    d = client.get(f"/api/forms/{fid}/download", headers=user["headers"])
    assert d.status_code == 200
    return d.content, g.json()["warnings"], ids


def save_pngs(pdf: bytes, stem: str) -> None:
    OUT.mkdir(exist_ok=True)
    with fitz.open(stream=pdf, filetype="pdf") as doc:
        for i, page in enumerate(doc, 1):
            page.get_pixmap(dpi=110).save(str(OUT / f"{stem}_p{i}.png"))


def page_text(pdf: bytes, page: int = 1) -> str:
    with fitz.open(stream=pdf, filetype="pdf") as doc:
        p = doc[page - 1]
        widgets = " ".join(str(w.field_value or "") for w in p.widgets() or [])
        return p.get_text() + " " + widgets


@pytest.mark.parametrize("text,script", [("Jayanagar", "latn"), ("जयनगर", "deva"), ("ಜಯನಗರ", "knda"), ("राम Kumar", "deva")])
def test_script_detection(text, script):
    assert _script(text) == script


def test_fillable_form_english_values_are_in_the_widgets(client, alice):
    pdf, warnings, _ = fill_and_download(client, alice, kcc_form_pdf(), "kcc.pdf", {
        "Branch": "Jayanagar", "To": "The Branch Manager", "Name of Applicant": "Nithin", "Account Number": "123456789012",
        "IFSC Code": "SBIN0001234", "Mobile Number": "9876543210", "Select one": "Renewal"})
    save_pngs(pdf, "kcc_english")
    text = page_text(pdf)
    assert not warnings
    for v in ("Jayanagar", "The Branch Manager", "Nithin", "123456789012", "SBIN0001234", "9876543210", "Renewal"):
        assert v in text, v


def test_fillable_form_hindi_and_kannada_values_are_drawn(client, alice):
    pdf, warnings, _ = fill_and_download(client, alice, kcc_form_pdf(), "kcc.pdf", {
        "Branch": "जयनगर", "To": "ಜಯನಗರ", "Name of Applicant": "राम Kumar", "Account Number": "123456789012"})
    save_pngs(pdf, "kcc_indic")
    text = page_text(pdf)
    assert not warnings, warnings
    for v in ("जयनगर", "ಜಯನಗರ", "Kumar", "123456789012"):
        assert v in text, (v, text)
    with fitz.open(stream=pdf, filetype="pdf") as doc:
        names = {w.field_name for w in doc[0].widgets() or []}
    assert "branch" not in names and "account" in names  # only the non-Latin fields were flattened


def test_layout_form_values_land_in_the_value_boxes(client, alice):
    pdf, warnings, _ = fill_and_download(client, alice, sample_form_pdf(), "form.pdf", {
        "Name of Applicant": "राम Kumar", "Land Survey Number": "123/4", "Taluk": "ಜಯನಗರ", "Gender": "Male"})
    save_pngs(pdf, "layout_mixed")
    assert not warnings, warnings
    with fitz.open(stream=pdf, filetype="pdf") as doc:
        page = doc[0]
        text = page.get_text()
        for v in ("Kumar", "123/4", "ಜಯನಗರ"):
            assert v in text, v
        # the value is written to the right of its label, never on top of it
        label = page.search_for("Name of Applicant")[0]
        value = page.search_for("Kumar")[0]
        assert value.x0 >= label.x1 - 1


def test_value_that_cannot_fit_is_reported_not_silently_dropped(client, alice):
    long = "Jayanagar " * 60
    pdf, warnings, _ = fill_and_download(client, alice, sample_form_pdf(), "form.pdf", {"Taluk": long.strip()})
    assert any("Taluk" in w and "too long" in w for w in warnings), warnings
