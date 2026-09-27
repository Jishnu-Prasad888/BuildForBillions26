"""The screen assistant must explain fields in plain language, with or without an LLM.

Regression: with the LLM unavailable the assistant quoted raw scheme-guide text ("Farmer Attributes (Optional):
Father name, Address, ...", "... Rs.12/- per annum for PMSBY ...") as the explanation of a field.
"""
import json

import pytest

from app.config import settings
from app.database import SessionLocal
from app.models import Application
from app.services import form_help

SEED = settings.seed_path / "forms" / "crop_relief_form.json"
# The standard test container mounts only backend/; mount the repo's data/ at /data to run the seed-form tests:
#   docker run --rm -v "<repo>/backend:/work" -v "<repo>/data:/data" -w /work buildforbillions26-backend ...
needs_seed = pytest.mark.skipif(not SEED.exists(), reason="seed data not mounted at /data")

# The exact junk quoted in the bug report, plus a genuine explanatory sentence.
GARBAGE = [
    "Farmer Attributes (Optional): Father name, Address, Mobile Number, Date of Birth/Age, Farm-Size in Hectare, Survey Number, Khasra Number",
    ":- Rs.12/- per annum for PMSBY and Rs.330/- per annum for PMJJBY Particulars of total land holdings of the applicant and crops:",
    "Father name, Address, Mobile Number, Date of Birth/Age, Farm-Size in Hectare",
    "Particulars of total land holdings",
    "Sr. No. 3 Survey Number",
]
WORDS = form_help.content_words("Land survey number (Sy. No.) survey number RTC Pahani where to find")


@pytest.mark.parametrize("text", GARBAGE)
def test_headings_fee_lines_and_lists_are_never_used_as_explanations(text):
    assert form_help.is_useful_sentence(text, WORDS) is False


def test_a_real_sentence_about_the_field_is_accepted():
    s = "The survey number of your land is printed on your RTC (Pahani) record and you must quote it exactly."
    assert form_help.is_useful_sentence(s, WORDS) is True
    assert form_help.pick_guide_sentences(GARBAGE + [s], WORDS, limit=2) == [s]


def test_a_sentence_about_something_else_is_refused():
    assert form_help.is_useful_sentence("The premium for this cover is paid by the bank on your behalf every year.", WORDS) is False


@needs_seed
def test_every_field_of_the_demo_form_has_authored_help():
    form = json.loads(SEED.read_text(encoding="utf-8"))
    for section in form["sections"]:
        for field in section["fields"]:
            text = form_help.authored_help(field)
            assert 20 <= len(text) <= 260, field["id"]
            assert "Rs." not in text and ":-" not in text, field["id"]


# ------------------------------------------------------------------ end to end, LLM unavailable
@pytest.fixture()
def session(client, alice, monkeypatch):
    if not SEED.exists():
        pytest.skip("seed data not mounted at /data")
    from app.services import form_assistant as mod

    # the LLM path is down: no grounded answer, deterministic composition only
    monkeypatch.setattr(mod.agent, "answer", lambda *a, **k: {"answer": "", "evidence": [], "mode": "extractive",
                                                              "insufficient_evidence": True, "grounded": False})
    with SessionLocal() as db:
        app = Application(user_id=alice["id"], scheme_code="CROP_LOSS_RELIEF_KA", scheme_name="Crop Damage Assistance",
                          form_id="crop_relief_form", status="IN_PROGRESS")
        db.add(app)
        db.commit()
        app_id = app.id
    r = client.post("/api/screen-assistance/sessions", json={"application_id": app_id, "language": "en"}, headers=alice["headers"])
    assert r.status_code == 201, r.text
    first = r.json()
    sid = first.get("session_id") or first.get("id") or first.get("conversation_id")
    assert sid, first

    def say(text):
        m = client.post(f"/api/screen-assistance/sessions/{sid}/messages", json={"text": text}, headers=alice["headers"])
        assert m.status_code == 200, m.text
        return m.json()

    return first, say


def _reply(payload) -> str:
    return payload.get("reply") or payload.get("message") or ""


def test_the_next_question_is_a_clean_sentence_with_real_help(session):
    _, say = session
    text = _reply(say("yes"))  # accept the profile name; the next field is the father's / spouse's name
    assert "Next: **Father's / Spouse's name**" in text
    assert "Aadhaar or land records" in text and "What should I enter?" in text
    for junk in ("Farmer Attributes", "Rs.12", "per annum", "Khasra", "Date of Birth/Age"):
        assert junk not in text


def test_asking_where_to_find_a_field_gets_its_plain_language_help(session):
    _, say = session
    text = _reply(say("where to find my fathers name"))  # "fathers" must match the label "Father's / Spouse's name"
    assert "Father's / Spouse's name" in text and "Aadhaar or land records" in text
    assert "Farmer Attributes" not in text and "Khasra" not in text
    assert text.count("tell me your") == 1  # one re-ask, not a pile of fragments


def test_asking_about_a_different_field_explains_that_field_then_returns(session):
    _, say = session
    text = _reply(say("what is land survey number"))
    assert "RTC (Pahani)" in text and "45/2A" in text
    assert "Rs.12" not in text and "per annum" not in text
    assert "tell me your **Full name of applicant**" in text  # back to the field being asked
