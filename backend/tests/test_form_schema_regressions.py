"""Regressions for the document-structure / form-schema layer (structure.py, fields.py, service.py, answers.py).

Each test pins a bug that was found in review: a crash, a contract the frontend depends on, a field that was
hidden or invented, or a spelling "correction" that rewrote a real name.
"""
import fitz
import pytest

from app.services.formdoc import answers, fields as fs, service
from tests.make_forms import kcc_form_pdf
from tests.test_forms import ready_form, schema


# ------------------------------------------------------------------ not-applicable must not crash the form
class _Row:
    def __init__(self, value):
        self.value = value


def test_not_applicable_marker_is_a_blank_and_never_crashes():
    rows = {"a": _Row({"v": "x"}), "b": _Row({"not_applicable": True}), "c": _Row({"blank": True}), "d": _Row({"skipped": True})}
    values, skipped, blank = service.split_values(rows)
    assert values == {"a": "x"} and blank == {"b", "c"} and skipped == {"d"}


def test_saying_i_dont_have_it_then_not_applicable_leaves_the_form_working(client, alice, monkeypatch):
    from app.services.formdoc import assistant as mod
    monkeypatch.setattr(mod.agent, "answer", lambda *a, **k: {"answer": "", "evidence": [], "insufficient_evidence": True, "grounded": True})
    fid = ready_form(client, alice, kcc_form_pdf(), "kcc.pdf")
    say = lambda msg, pending=None: client.post(f"/api/forms/{fid}/assistant", json={"message": msg, "pending_field_id": pending},
                                                 headers=alice["headers"])
    first = say("").json()
    r = say("I don't have a branch", first["pending_field_id"])
    assert r.status_code == 200
    r = say("not applicable", r.json()["pending_field_id"] or first["pending_field_id"])
    assert r.status_code == 200
    # the marker is stored and every later read of the form still works
    sch = client.get(f"/api/forms/{fid}/schema", headers=alice["headers"])
    assert sch.status_code == 200 and sch.json()["values"] == {}
    assert client.get(f"/api/forms/{fid}/review", headers=alice["headers"]).status_code == 200


# ------------------------------------------------------------------ the frontend's type vocabulary is unchanged
def test_api_keeps_detector_types_and_adds_schema_type(client, alice):
    sch = schema(client, alice, ready_form(client, alice, kcc_form_pdf(), "kcc.pdf"))
    by = {f["label"]: f for f in sch["fields"]}
    assert by["Select one"]["type"] == "choice" and by["Select one"]["schema_type"] == "select"
    assert by["Account Number"]["type"] == "bank_account" and by["Account Number"]["schema_type"] == "text"
    assert by["Name of Applicant"]["type"] == "name"


def test_rows_written_before_the_new_columns_keep_their_type():
    # migration default for input_type is "text"; the detector type of an old row lives in `type`
    assert service.detector_type("choice", "text") == "choice"
    assert service.detector_type("multiline", "text") == "multiline"
    assert service.detector_type("text", "name") == "name"
    assert service.detector_type("select", "choice") == "choice"
    assert service.detector_type("text", "text") == "text"


# ------------------------------------------------------------------ conditions fail safe
def _spouse():
    return fs.condition_for("Spouse Name", "", "")


@pytest.mark.parametrize("answer,applies", [("Married", True), ("Unmarried", False), ("Single", False),
                                            ("Divorced", True), ("Widowed", True)])
def test_spouse_field_is_hidden_only_by_an_explicit_no(answer, applies):
    marital = {"field_id": "m", "label": "Marital Status", "normalized_label": "marital_status"}
    assert fs.condition_applies(_spouse(), [marital], {"m": answer}) is applies


def test_unanswered_or_unknown_trigger_keeps_the_field():
    assert fs.condition_applies(_spouse(), [], {}) is True
    assert fs.condition_applies(_spouse(), [{"field_id": "m", "label": "Marital Status"}], {}) is True


def test_ordinary_fields_are_never_conditional():
    for label in ("Father's/ Spouse Name", "Residential Address", "Permanent Account Number (PAN)", "Nationality"):
        assert fs.condition_for(label, "", "") is None, label


def test_trigger_hint_matches_whole_words_only():
    when = {"kind": "minor", "field": "age", "label_hint": "age", "equals": ["minor"], "not_equals": ["adult"]}
    village = {"field_id": "v", "label": "Village", "normalized_label": "village"}
    assert fs.condition_applies(when, [village], {"v": "adult"}) is True   # "age" is inside "Village", not a word


# ------------------------------------------------------------------ names: variants are not typos
@pytest.mark.parametrize("name", ["Nithin", "Dhanush", "Shreeya", "Jishnu Prasad"])
def test_valid_name_spellings_are_left_alone(name):
    assert answers.suggest_spelling(name, "name") is None


def test_a_real_typo_is_offered_never_applied():
    assert answers.suggest_spelling("jishnu prsad", "name") == "jishnu Prasad"


# ------------------------------------------------------------------ headings, sections, photo boxes
def _kyc_like_pdf() -> bytes:
    doc = fitz.open()
    p = doc.new_page(width=595, height=842)

    def T(x, y, s, size=11):
        p.insert_text((x, y), s, fontsize=size, fontname="helv")

    T(110, 50, "KNOW YOUR CLIENT (KYC) APPLICATION FORM", 15)
    T(50, 95, "A. IDENTITY DETAILS", 12)
    T(50, 125, "Please fill this form in BLOCK LETTERS and attach a recent photograph.")
    T(50, 165, "Name of Applicant:")
    p.draw_line((190, 168), (400, 168), width=0.8)
    T(50, 205, "Date of Birth: __/__/____")
    T(50, 245, "PAN:")
    p.draw_rect(fitz.Rect(190, 231, 330, 251), width=0.8)
    p.draw_rect(fitz.Rect(430, 160, 540, 260), width=0.8)
    T(385, 275, "Affix recent passport size photograph")
    T(50, 300, "Enter your details as per the Aadhaar card.")
    T(50, 340, "B. FOR OFFICE USE ONLY", 12)
    T(50, 370, "Date:")
    p.draw_line((100, 373), (250, 373), width=0.8)
    T(50, 640, "C. DECLARATION", 12)
    T(50, 700, "Signature of Applicant:")
    p.draw_line((190, 703), (400, 703), width=0.8)
    return doc.tobytes()


class TestDocumentStructure:
    @pytest.fixture()
    def sch(self, client, alice):
        return schema(client, alice, ready_form(client, alice, _kyc_like_pdf(), "kyc.pdf"))

    def test_titles_headings_and_instructions_are_not_fields(self, sch):
        labels = [f["label"] for f in sch["fields"]]
        assert {"Name of Applicant", "Date of Birth", "PAN"} <= set(labels)
        for bad in ("KNOW YOUR CLIENT", "IDENTITY DETAILS", "BLOCK LETTERS", "Aadhaar card", "OFFICE USE"):
            assert not any(bad in lab for lab in labels), (bad, labels)

    def test_title_and_sections_are_recorded_and_fields_carry_their_section(self, sch):
        page = sch["pages"][0]
        assert page["title"] == "KNOW YOUR CLIENT (KYC) APPLICATION FORM"
        assert page["sections"][:2] == ["A. IDENTITY DETAILS", "B. FOR OFFICE USE ONLY"]
        assert next(f for f in sch["fields"] if f["label"] == "PAN")["section"] == "A. IDENTITY DETAILS"

    def test_field_under_office_use_heading_is_never_asked(self, sch):
        assert "Date" not in [f["label"] for f in sch["fields"]]

    def test_photograph_box_is_a_manual_field_not_a_text_box(self, sch):
        photo = [f for f in sch["fields"] if f["type"] == "photograph"]
        assert len(photo) == 1 and photo[0]["manual"] is True
        assert sch["summary"]["manual"] >= 1

    def test_signature_under_its_own_heading_is_kept_as_manual(self, sch):
        sig = next(f for f in sch["fields"] if f["type"] == "signature")
        assert sig["manual"] is True

    def test_printed_sentences_do_not_flood_the_review_candidates(self, sch):
        assert sch["candidates"] == []
