import fitz
import pytest

from app.services.formdoc import extract
from tests.make_forms import encrypted_pdf, fillable_pdf, render_png, rotated_form_pdf, sample_form_pdf


def up(client, user, data: bytes, name="form.pdf", mime=None):
    mime = mime or ("image/png" if name.endswith(".png") else "application/pdf")
    return client.post("/api/forms/upload", files={"file": (name, data, mime)}, headers=user["headers"])


def ready_form(client, user, data=None, name="form.pdf") -> str:
    r = up(client, user, data or sample_form_pdf(), name)
    assert r.status_code == 201, r.text
    fid = r.json()["id"]
    a = client.post(f"/api/forms/{fid}/analyze", json={}, headers=user["headers"])
    assert a.status_code == 202
    got = client.get(f"/api/forms/{fid}", headers=user["headers"]).json()
    assert got["status"] == "READY", got
    return fid


def schema(client, user, fid):
    r = client.get(f"/api/forms/{fid}/schema", headers=user["headers"])
    assert r.status_code == 200, r.text
    return r.json()


def by_label(sch, prefix):
    return next(f for f in sch["fields"] if f["label"].startswith(prefix))


# ------------------------------------------------------------------ upload security
class TestUploadValidation:
    def test_requires_auth(self, client):
        assert client.post("/api/forms/upload", files={"file": ("a.pdf", sample_form_pdf(), "application/pdf")}).status_code == 401

    @pytest.mark.parametrize("name,data,mime", [
        ("evil.exe", b"MZ\x90\x00", "application/octet-stream"),
        ("form.pdf", b"not a pdf at all", "application/pdf"),           # bad magic bytes
        ("form.png", sample_form_pdf(), "image/png"),                     # pdf bytes, image extension
        ("../../etc/passwd.pdf", sample_form_pdf(), "application/pdf"),   # traversal
        ("a\\b.pdf", sample_form_pdf(), "application/pdf"),
        ("form.pdf", sample_form_pdf(), "text/html"),                     # lying MIME
        ("form.pdf", b"", "application/pdf"),
    ])
    def test_rejected(self, client, alice, name, data, mime):
        assert up(client, alice, data, name, mime).status_code in (413, 422)

    def test_encrypted_pdf_rejected(self, client, alice):
        r = up(client, alice, encrypted_pdf())
        assert r.status_code == 422 and "password" in r.json()["detail"].lower()

    def test_size_limit(self, client, alice, monkeypatch):
        from app.config import settings
        monkeypatch.setattr(settings, "MAX_FORM_SIZE_MB", 1)
        assert up(client, alice, sample_form_pdf() + b"0" * (2 * 1024 * 1024)).status_code == 413

    def test_stored_name_is_server_generated(self, client, alice, storage_root):
        fid = up(client, alice, sample_form_pdf(), "My Aadhaar Form (final).pdf").json()["id"]
        files = [p.name for p in (storage_root / alice["id"] / "forms" / fid / "original").iterdir()]
        assert files == ["original.pdf"]


# ------------------------------------------------------------------ pipeline + original preservation (demo tests 1 and 5)
class TestPdfFlow:
    def test_analysis_detects_fields(self, client, alice):
        sch = schema(client, alice, ready_form(client, alice))
        labels = {f["label"]: f for f in sch["fields"]}
        assert "Name of Applicant" in labels and labels["Date of Birth"]["type"] == "date"
        assert labels["Gender"]["type"] == "choice" and labels["Gender"]["options"] == ["Male", "Female", "Other"]
        assert labels["Identity Proof"]["options"] == ["Aadhaar", "Driving Licence"]
        assert labels["Phone Number"]["type"] == "phone" and labels["Address"]["type"] == "multiline"
        assert labels["Signature of Applicant"]["manual"] is True
        assert all(len(f["bbox"]) == 4 and f["page"] == 1 and 0 <= f["confidence"] <= 1 for f in sch["fields"])
        assert sch["pages"][0]["width"] == pytest.approx(595, abs=1)

    def test_generate_preserves_original_byte_for_byte(self, client, alice, storage_root):
        fid = ready_form(client, alice)
        orig = storage_root / alice["id"] / "forms" / fid / "original" / "original.pdf"
        before = orig.read_bytes()
        mtime = orig.stat().st_mtime_ns
        sch = schema(client, alice, fid)
        ids = {f["label"]: f["field_id"] for f in sch["fields"]}
        r = client.post(f"/api/forms/{fid}/autofill", headers=alice["headers"], json={"values": {
            ids["Name of Applicant"]: "Alice Rao", ids["Date of Birth"]: "25/12/1990", ids["Gender"]: "Female",
            ids["Address"]: "12 Temple Road, Koppa, Mandya", ids["Phone Number"]: "98765 43210", ids["Identity Proof"]: "Aadhaar",
            ids["Land Survey Number"]: "45/2A", ids["Taluk"]: "Maddur"}})
        assert r.status_code == 200 and r.json()["errors"] == {}
        rv = client.get(f"/api/forms/{fid}/review", headers=alice["headers"]).json()
        assert rv["can_generate"] is True
        g = client.post(f"/api/forms/{fid}/generate", json={}, headers=alice["headers"])
        assert g.status_code == 200, g.text
        assert g.json()["warnings"] == []
        assert orig.read_bytes() == before and orig.stat().st_mtime_ns == mtime  # untouched
        dl = client.get(f"/api/forms/{fid}/download", headers=alice["headers"])
        assert dl.status_code == 200 and dl.headers["content-type"] == "application/pdf" and dl.content != before
        doc = fitz.open(stream=dl.content, filetype="pdf")
        text = doc[0].get_text()
        assert doc.page_count == 1 and "Alice Rao" in text and "25/12/1990" in text and "9876543210" in text
        assert "CROP LOSS APPLICATION FORM" in text  # existing content preserved (not rasterised)
        assert "completed" in dl.headers["content-disposition"]
        assert client.get(f"/api/forms/{fid}/preview?page=1&source=completed", headers=alice["headers"]).headers["content-type"] == "image/png"
        assert client.get(f"/api/forms/{fid}/preview?page=1", headers=alice["headers"]).status_code == 200
        assert (storage_root / alice["id"] / "forms" / fid / "output" / "completed.pdf").is_file()

    def test_missing_required_blocks_generation_unless_explicitly_blank(self, client, alice):
        fid = ready_form(client, alice)
        sch = schema(client, alice, fid)
        g = client.post(f"/api/forms/{fid}/generate", json={}, headers=alice["headers"])
        assert g.status_code == 422 and g.json()["detail"]["code"] == "missing_required"
        missing = [m["field_id"] for m in g.json()["detail"]["missing"]]
        assert by_label(sch, "Signature")["field_id"] not in missing  # signatures are done by hand, never "missing"
        g2 = client.post(f"/api/forms/{fid}/generate", json={"allow_blank": missing}, headers=alice["headers"])
        assert g2.status_code == 200

    def test_invalid_values_are_reported_not_stored(self, client, alice):
        fid = ready_form(client, alice)
        sch = schema(client, alice, fid)
        r = client.post(f"/api/forms/{fid}/autofill", headers=alice["headers"], json={"values": {
            by_label(sch, "Phone")["field_id"]: "12345", by_label(sch, "Date of")["field_id"]: "31/02/2020", by_label(sch, "Gender")["field_id"]: "Robot"}}).json()
        assert len(r["errors"]) == 3 and r["values"] == {}

    def test_profile_autofill_only_suggests_matching_fields(self, client, alice):
        fid = ready_form(client, alice)
        sch = schema(client, alice, fid)
        assert sch["profile_suggestions"][by_label(sch, "Phone")["field_id"]] == "9876543210"
        r = client.post(f"/api/forms/{fid}/autofill", headers=alice["headers"], json={"use_profile": True}).json()
        assert r["values"][by_label(sch, "Phone")["field_id"]] == "9876543210"
        assert r["sources"][by_label(sch, "Phone")["field_id"]] == "profile"

    def test_fillable_pdf_uses_real_form_fields(self, client, alice, storage_root):
        fid = ready_form(client, alice, fillable_pdf(), "fillable.pdf")
        sch = schema(client, alice, fid)
        assert sch["form"]["analysis"]["fillable"] is True
        assert {f["source"] for f in sch["fields"]} == {"acroform"}
        ids = {f["label"]: f["field_id"] for f in sch["fields"]}
        name_id = next(v for k, v in ids.items() if "Name" in k)
        mob_id = next(v for k, v in ids.items() if "Mobile" in k)
        client.post(f"/api/forms/{fid}/autofill", headers=alice["headers"], json={"values": {name_id: "Alice Rao", mob_id: "9876543210"}})
        assert client.post(f"/api/forms/{fid}/generate", json={"allow_blank": [v for k, v in ids.items() if "agree" in k.lower()]}, headers=alice["headers"]).status_code == 200
        doc = fitz.open(stream=client.get(f"/api/forms/{fid}/download", headers=alice["headers"]).content, filetype="pdf")
        vals = {w.field_name: w.field_value for w in doc[0].widgets()}
        assert vals["full_name"] == "Alice Rao" and vals["mobile"] == "9876543210"

    def test_rotated_page_is_filled_in_the_right_place(self, client, alice, storage_root):
        fid = ready_form(client, alice, rotated_form_pdf())
        sch = schema(client, alice, fid)
        assert sch["pages"][0]["width"] == pytest.approx(595, abs=1) and sch["pages"][0]["height"] == pytest.approx(842, abs=1)  # as displayed
        ids = {f["label"]: f["field_id"] for f in sch["fields"]}
        assert "Name of Applicant" in ids and ids["Gender"]
        client.post(f"/api/forms/{fid}/autofill", headers=alice["headers"], json={"values": {ids["Name of Applicant"]: "Alice Rao", ids["Gender"]: "Male"}})
        g = client.post(f"/api/forms/{fid}/generate", json={"allow_blank": [v for k, v in ids.items() if k not in ("Name of Applicant", "Gender")]}, headers=alice["headers"])
        assert g.status_code == 200 and g.json()["warnings"] == []
        (storage_root / "rot.png").write_bytes(client.get(f"/api/forms/{fid}/preview?page=1&source=completed", headers=alice["headers"]).content)

    def test_reanalysis_keeps_original(self, client, alice, storage_root):
        fid = ready_form(client, alice)
        orig = storage_root / alice["id"] / "forms" / fid / "original" / "original.pdf"
        before = orig.read_bytes()
        assert client.post(f"/api/forms/{fid}/analyze", json={"force": True}, headers=alice["headers"]).status_code == 202
        assert orig.read_bytes() == before


class TestImageFlow:
    def test_photo_pipeline_and_pdf_output(self, client, alice, monkeypatch, storage_root):
        pdf = sample_form_pdf()
        png = render_png(pdf)
        scale = 170 / 72
        with fitz.open(stream=pdf, filetype="pdf") as d:
            words = [(x0 * scale, y0 * scale, x1 * scale, y1 * scale, t, 90.0) for x0, y0, x1, y1, t, *_ in d[0].get_text("words")]
        monkeypatch.setattr(extract, "ocr_tokens", lambda gray, lang="en": (words, 90.0))  # Tesseract isn't required to test the rest
        fid = ready_form(client, alice, png, "photo.png")
        sch = schema(client, alice, fid)
        assert sch["form"]["kind"] == "image" and sch["pages"][0]["text_source"] == "ocr"
        labels = {f["label"]: f for f in sch["fields"]}
        assert labels["Gender"]["options"] == ["Male", "Female", "Other"] and "Name of Applicant" in labels
        ids = {f["label"]: f["field_id"] for f in sch["fields"]}
        orig = storage_root / alice["id"] / "forms" / fid / "original" / "original.png"
        before = orig.read_bytes()
        assert client.post(f"/api/forms/{fid}/autofill", headers=alice["headers"], json={"values": {ids["Gender"]: "Male"}}).status_code == 200
        g = client.post(f"/api/forms/{fid}/generate", json={"allow_blank": [f["field_id"] for f in sch["fields"] if f["field_id"] != ids["Gender"]]}, headers=alice["headers"])
        assert g.status_code == 200, g.text
        out = fitz.open(stream=client.get(f"/api/forms/{fid}/download", headers=alice["headers"]).content, filetype="pdf")
        assert out.page_count == 1 and orig.read_bytes() == before

    def test_unreadable_page_gives_clear_message(self, client, alice, monkeypatch):
        monkeypatch.setattr(extract, "ocr_tokens", lambda gray, lang="en": ([], None))
        fid = up(client, alice, render_png(sample_form_pdf()), "photo.png").json()["id"]
        client.post(f"/api/forms/{fid}/analyze", json={}, headers=alice["headers"])
        f = client.get(f"/api/forms/{fid}", headers=alice["headers"]).json()
        assert f["status"] == "FAILED" and "couldn't read this page clearly" in f["error"]
        assert client.get(f"/api/forms/{fid}/schema", headers=alice["headers"]).status_code == 409


# ------------------------------------------------------------------ isolation (demo test 4)
class TestIsolation:
    def test_user_b_cannot_touch_user_a_data(self, client, alice, bob):
        fid = ready_form(client, alice)
        sch = schema(client, alice, fid)
        client.post(f"/api/forms/{fid}/autofill", headers=alice["headers"], json={"values": {by_label(sch, "Phone")["field_id"]: "9876543210"}})
        client.post(f"/api/forms/{fid}/notes", json={"content": "secret note"}, headers=alice["headers"])
        client.post(f"/api/forms/{fid}/generate", json={"allow_blank": [f["field_id"] for f in sch["fields"]]}, headers=alice["headers"])
        h = bob["headers"]
        checks = [("get", f"/api/forms/{fid}"), ("get", f"/api/forms/{fid}/schema"), ("get", f"/api/forms/{fid}/preview?page=1"),
                  ("get", f"/api/forms/{fid}/preview?page=1&source=completed"), ("get", f"/api/forms/{fid}/download"), ("get", f"/api/forms/{fid}/notes"),
                  ("get", f"/api/forms/{fid}/review"), ("get", f"/api/forms/{fid}/assistant"), ("delete", f"/api/forms/{fid}")]
        for method, url in checks:
            assert getattr(client, method)(url, headers=h).status_code == 404, url
        for url, body in [(f"/api/forms/{fid}/analyze", {}), (f"/api/forms/{fid}/assistant", {"message": "hi"}), (f"/api/forms/{fid}/autofill", {"values": {}}),
                          (f"/api/forms/{fid}/generate", {}), (f"/api/forms/{fid}/notes", {"content": "x"}), (f"/api/forms/{fid}/assistant/end", {})]:
            assert client.post(url, json=body, headers=h).status_code == 404, url
        assert client.get("/api/forms", headers=h).json() == []
        assert client.get(f"/api/forms/{fid}/download", headers=alice["headers"]).status_code == 200  # A still can
        assert client.get(f"/api/forms/{fid}", headers={}).status_code == 401

    def test_note_of_other_form_not_reachable_through_own_form(self, client, alice, bob):
        fa, fb = ready_form(client, alice), ready_form(client, bob)
        nid = client.post(f"/api/forms/{fa}/notes", json={"content": "mine"}, headers=alice["headers"]).json()["id"]
        assert client.patch(f"/api/forms/{fb}/notes/{nid}", json={"content": "hax"}, headers=bob["headers"]).status_code == 404
        assert client.delete(f"/api/forms/{fa}/notes/{nid}", headers=bob["headers"]).status_code == 404

    def test_storage_is_not_served_publicly(self, client, alice, storage_root):
        fid = ready_form(client, alice)
        for path in (f"/data/users/{alice['id']}/forms/{fid}/original/original.pdf", f"/users/{alice['id']}/forms/{fid}/original/original.pdf",
                     f"/api/forms/{fid}/original", f"/api/forms/../data/users/{alice['id']}"):
            assert client.get(path, headers=alice["headers"]).status_code in (401, 404, 405)


# ------------------------------------------------------------------ notes
class TestNotes:
    def test_ai_and_user_notes_are_separate(self, client, alice):
        fid = ready_form(client, alice)
        n = client.post(f"/api/forms/{fid}/notes", json={"content": "Need to find survey number."}, headers=alice["headers"]).json()
        sch = schema(client, alice, fid)
        client.post(f"/api/forms/{fid}/autofill", headers=alice["headers"], json={"values": {by_label(sch, "Identity")["field_id"]: "Aadhaar"}})
        data = client.get(f"/api/forms/{fid}/notes", headers=alice["headers"]).json()
        assert [x["content"] for x in data["user_notes"]] == ["Need to find survey number."]
        assert data["ai_notes"]["detected"] == len(sch["fields"]) and any("Aadhaar" in x for x in data["ai_notes"]["notes"])
        assert client.patch(f"/api/forms/{fid}/notes/{n['id']}", json={"done": True}, headers=alice["headers"]).json()["done"] is True


# ------------------------------------------------------------------ delete lifecycle
class TestDelete:
    def test_delete_removes_files_and_rows(self, client, alice, storage_root):
        fid = ready_form(client, alice)
        sch = schema(client, alice, fid)
        client.post(f"/api/forms/{fid}/notes", json={"content": "x"}, headers=alice["headers"])
        client.post(f"/api/forms/{fid}/assistant", json={"message": ""}, headers=alice["headers"])
        client.post(f"/api/forms/{fid}/generate", json={"allow_blank": [f["field_id"] for f in sch["fields"]]}, headers=alice["headers"])
        d = storage_root / alice["id"] / "forms"
        assert client.delete(f"/api/forms/{fid}", headers=alice["headers"]).status_code == 200
        assert list(d.iterdir()) == [] or all(not p.name.startswith(fid) and not p.name.startswith(".trash") for p in d.iterdir())
        assert client.get(f"/api/forms/{fid}", headers=alice["headers"]).status_code == 404
        from app.database import SessionLocal
        from app.models import FormField, FormNote, FormPage, FormValue
        db = SessionLocal()
        try:
            for m in (FormField, FormPage, FormNote, FormValue):
                assert db.query(m).filter(m.form_id == fid).count() == 0
        finally:
            db.close()

    def test_failed_db_delete_restores_files(self, client, alice, storage_root, monkeypatch):
        fid = ready_form(client, alice)
        from sqlalchemy.orm import Session
        real = Session.commit

        def boom(self):
            raise RuntimeError("db down")

        monkeypatch.setattr(Session, "commit", boom)
        assert client.delete(f"/api/forms/{fid}", headers=alice["headers"]).status_code == 500
        monkeypatch.setattr(Session, "commit", real)
        assert (storage_root / alice["id"] / "forms" / fid / "original" / "original.pdf").is_file()
        assert client.get(f"/api/forms/{fid}", headers=alice["headers"]).status_code == 200


# ------------------------------------------------------------------ assistant
class TestAssistant:
    @pytest.fixture(autouse=True)
    def _no_kag(self, monkeypatch):
        """KAG needs Neo4j/Postgres full text; here it answers "no evidence" unless a test overrides it."""
        from app.services.formdoc import assistant as mod
        monkeypatch.setattr(mod.agent, "answer", lambda *a, **k: {"answer": "", "evidence": [], "insufficient_evidence": True, "grounded": True})

    def say(self, client, user, fid, msg, field=None):
        r = client.post(f"/api/forms/{fid}/assistant", json={"message": msg, "current_field_id": field}, headers=user["headers"])
        assert r.status_code == 200, r.text
        return r.json()

    def test_asks_field_by_field_and_stores_answers(self, client, alice):
        fid = ready_form(client, alice)
        g = self.say(client, alice, fid, "")
        assert "fields" in g["reply"] and g["ask"]["label"] == "Name of Applicant"
        r = self.say(client, alice, fid, "Alice Rao")
        assert list(r["field_updates"].values()) == ["Alice Rao"] and r["ask"]["label"] == "Date of Birth"
        r = self.say(client, alice, fid, "not a date")
        assert not r["field_updates"] and r["ask"]["label"] == "Date of Birth"       # asks again, doesn't guess
        r = self.say(client, alice, fid, "skip")
        assert r["ask"]["label"] == "Gender" and r["choices"] == ["Male", "Female", "Other"]
        assert self.say(client, alice, fid, "Female")["summary"]["completed"] == 2

    def test_ambiguous_choice_triggers_clarification(self, client, alice):
        fid = ready_form(client, alice)
        sch = schema(client, alice, fid)
        ident = by_label(sch, "Identity")["field_id"]
        r = self.say(client, alice, fid, "I have both", ident)
        assert r["clarification"] is True and r["choices"] == ["Aadhaar", "Driving Licence"] and not r["field_updates"]
        assert "only one" in r["reply"] or "Which one" in r["reply"]
        r2 = self.say(client, alice, fid, "aadhaar")
        assert r2["field_updates"][ident] == "Aadhaar" and r2["clarification"] is False

    def test_same_as_before_with_several_addresses_asks_which(self, client, alice):
        f1 = ready_form(client, alice)
        s1 = schema(client, alice, f1)
        client.post(f"/api/forms/{f1}/autofill", headers=alice["headers"], json={"values": {by_label(s1, "Address")["field_id"]: "1 First Street, Mandya"}})
        f0 = ready_form(client, alice)
        s0 = schema(client, alice, f0)
        client.post(f"/api/forms/{f0}/autofill", headers=alice["headers"], json={"values": {by_label(s0, "Address")["field_id"]: "9 Second Road, Hassan"}})
        f2 = ready_form(client, alice)
        addr = by_label(schema(client, alice, f2), "Address")["field_id"]
        r = self.say(client, alice, f2, "My address is the same as before", addr)
        assert r["clarification"] is True and "more than one" in r["reply"] and "First Street" in r["reply"] and "Second Road" in r["reply"]
        r2 = self.say(client, alice, f2, "2")
        assert r2["field_updates"][addr] in ("1 First Street, Mandya", "9 Second Road, Hassan") and r2["clarification"] is False

    def test_same_as_before_with_single_candidate_is_used_and_disclosed(self, client, alice):
        f1 = ready_form(client, alice)
        client.post(f"/api/forms/{f1}/autofill", headers=alice["headers"], json={"values": {by_label(schema(client, alice, f1), "Address")["field_id"]: "1 First Street, Mandya"}})
        f2 = ready_form(client, alice)
        addr = by_label(schema(client, alice, f2), "Address")["field_id"]
        r = self.say(client, alice, f2, "same as before", addr)
        assert r["field_updates"][addr] == "1 First Street, Mandya" and "change it" in r["reply"]

    def test_never_handles_otp_password_pin(self, client, alice, storage_root):
        fid = ready_form(client, alice)
        r = self.say(client, alice, fid, "my otp is 482913")
        assert "OTP" in r["reply"] and not r["field_updates"]
        from app.database import SessionLocal
        from app.models import FormAssistanceSession
        db = SessionLocal()
        try:
            state = db.query(FormAssistanceSession).filter_by(form_id=fid).one().state
            assert "482913" not in str(state)
        finally:
            db.close()

    def test_sensitive_values_are_masked_in_replies_and_not_kept_in_history(self, client, alice):
        fid = ready_form(client, alice)
        sch = schema(client, alice, fid)
        ident = by_label(sch, "Identity")["field_id"]
        client.post(f"/api/forms/{fid}/autofill", headers=alice["headers"], json={"values": {ident: "Aadhaar"}})
        r = self.say(client, alice, fid, "Aadhaar", ident)
        assert r["field_updates"] == {ident: "Aadhaar"}
        self.say(client, alice, fid, "Alice Rao", by_label(sch, "Name of")["field_id"])
        self.say(client, alice, fid, "98765 43210", by_label(sch, "Phone")["field_id"])
        hist = str(client.get(f"/api/forms/{fid}/assistant", headers=alice["headers"]).json()["history"])
        assert "Alice Rao" not in hist and "9876543210" not in hist and "98765" not in hist  # transcript keeps no entered values
        rv = client.get(f"/api/forms/{fid}/review", headers=alice["headers"]).json()
        assert next(i for i in rv["items"] if i["field_id"] == ident)["display"] == "Aadhaar"

    def test_question_without_evidence_says_it_cannot_verify(self, client, alice):
        fid = ready_form(client, alice)
        sch = schema(client, alice, fid)
        r = self.say(client, alice, fid, "Where do I find this number?", by_label(sch, "Land Survey")["field_id"])
        kinds = [s["kind"] for s in r["sections"]]
        assert kinds[0] == "form_observation" and "Land Survey Number" in r["sections"][0]["text"]
        assert "I couldn't verify this from the uploaded form or available official sources." in r["reply"]
        assert "knowledge" not in kinds and not r["evidence"]

    def test_question_with_evidence_separates_form_from_knowledge(self, client, alice, monkeypatch):
        from app.services.formdoc import assistant as mod
        ev = [{"id": "chunk_1", "title": "Land records guide"}]
        monkeypatch.setattr(mod.agent, "answer", lambda *a, **k: {"answer": "A taluk is an administrative division [chunk_1].", "evidence": ev, "insufficient_evidence": False, "grounded": True})
        fid = ready_form(client, alice)
        r = self.say(client, alice, fid, "What is a taluk?", by_label(schema(client, alice, fid), "Taluk")["field_id"])
        assert [s["kind"] for s in r["sections"][:2]] == ["form_observation", "knowledge"] and r["evidence"] == ev

    def test_llm_never_sees_entered_values(self, client, alice, monkeypatch):
        seen = []
        from app.services.formdoc import assistant as mod
        monkeypatch.setattr(mod.agent, "answer", lambda db, q, lang=None, **k: seen.append((q, k.get("extra_context", ""))) or {"evidence": [], "insufficient_evidence": True})
        fid = ready_form(client, alice)
        sch = schema(client, alice, fid)
        client.post(f"/api/forms/{fid}/autofill", headers=alice["headers"], json={"values": {by_label(sch, "Phone")["field_id"]: "9876543210"}})
        self.say(client, alice, fid, "What is this field? my aadhaar is 2345 6789 0123", by_label(sch, "Identity")["field_id"])
        blob = " ".join(q + c for q, c in seen)
        assert "9876543210" not in blob and "2345" not in blob and "6789" not in blob  # long numbers are masked before anything leaves the server

    def test_summary_question_answered_from_form(self, client, alice):
        fid = ready_form(client, alice)
        r = self.say(client, alice, fid, "How many fields are left?")
        assert r["sections"][0]["kind"] == "form_observation" and "still need information" in r["reply"]

    def test_end_session(self, client, alice):
        fid = ready_form(client, alice)
        self.say(client, alice, fid, "")
        assert client.post(f"/api/forms/{fid}/assistant/end", json={}, headers=alice["headers"]).json() == {"ok": True}
        assert client.get(f"/api/forms/{fid}/assistant", headers=alice["headers"]).json()["active"] is False
