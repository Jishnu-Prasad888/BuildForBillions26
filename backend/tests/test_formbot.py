"""FormBot fixes (FORMBOT_FIX_PLAYBOOK.md): turn router, field hygiene, server-owned pointer, KCC transcript replay."""
from pathlib import Path

import pytest

from app.services.formdoc import turn_router
from app.services.formdoc.field_hygiene import clean_fields, is_office_only
from app.services.formdoc.values import match_options
from tests.make_forms import kcc_form_pdf
from tests.test_forms import ready_form, schema

FIXTURE = Path(__file__).parent / "fixtures" / "kcc_transcript.txt"


def F(label, ftype="text", options=None, fid=None):
    return {"field_id": fid or label.lower().replace(" ", "_"), "label": label, "type": ftype, "options": options or [],
            "meta": {}, "page": 1, "bbox": [0, 0, 1, 1], "description": ""}


BRANCH, TO, NAME = F("Branch"), F("To"), F("Name of Applicant", "name")
SELECT = F("Select one", "choice", ["New Card", "Renewal"])
ACCOUNT, MOBILE, ADDRESS = F("Account Number", "bank_account"), F("Mobile Number", "phone"), F("Address", "multiline")
ALL = [BRANCH, TO, SELECT, NAME, ACCOUNT, MOBILE, ADDRESS]


def route(text, field):
    return turn_router.route(text, field, ALL, option_match=lambda f, t: match_options(f["options"], t))


# (utterance, field, expected intent, expected value, expected target field or None for "the asked field")
CASES = [
    # English
    ("my name is Nithin", NAME, "answer", "Nithin", None),
    ("umm my name is Nithin", NAME, "answer", "Nithin", None),
    ("uh uh my my name is is Nithin", NAME, "answer", "Nithin", None),
    ("Nithin Kumar", NAME, "answer", "Nithin Kumar", None),
    ("I am Ravi Gowda", NAME, "answer", "Ravi Gowda", None),
    ("it is Jayanagar", BRANCH, "answer", "Jayanagar", None),
    ("the branch is Jayanagar", BRANCH, "answer", "Jayanagar", None),
    ("The Branch Manager", TO, "answer", "The Branch Manager", None),
    ("Branch Road, Jayanagar", ADDRESS, "answer", "Branch Road, Jayanagar", None),
    ("What is a branch?", BRANCH, "question", None, None),
    ("how do i find my branch name", BRANCH, "question", None, None),
    ("where can I find it", ACCOUNT, "question", None, None),
    ("which option should I choose", SELECT, "question", None, None),
    ("skip", BRANCH, "skip", None, None),
    ("skip this one please", BRANCH, "skip", None, None),
    ("later", BRANCH, "skip", None, None),
    ("i do not know", SELECT, "dont_know", None, None),
    ("I don't know", SELECT, "dont_know", None, None),
    ("not sure", BRANCH, "dont_know", None, None),
    ("renewal", SELECT, "answer", "renewal", None),
    ("2", SELECT, "answer", "2", None),
    ("thanks", TO, "other", None, None),
    ("hello", TO, "other", None, None),
    ("actually my branch is Koramangala", TO, "correction", "Koramangala", "branch"),
    ("sorry, it's Ravi", NAME, "correction", "Ravi", "name_of_applicant"),
    # Hinglish / Hindi (romanised)
    ("Bhaai mujhe account number kaisa janana padega ismein", BRANCH, "question", None, None),
    ("account number kaise pata karein", ACCOUNT, "question", None, None),
    ("KCC ke liye kaunse documents chahiye", ACCOUNT, "question", None, None),
    ("branch Jayanagar hai", BRANCH, "answer", "Jayanagar", None),
    ("branch Jayanagar hai", TO, "correction", "Jayanagar", "branch"),
    ("mera naam Ravi hai", NAME, "answer", "Ravi", None),
    ("haan mera number 98765 43210 hai", MOBILE, "answer", "98765 43210", None),
    ("pata nahi", BRANCH, "dont_know", None, None),
    ("nahi maloom", BRANCH, "dont_know", None, None),
    ("baad mein", BRANCH, "skip", None, None),
    ("chhodo", BRANCH, "skip", None, None),
    # Hindi / Kannada script
    ("मेरा नाम रवि है", NAME, "answer", "रवि", None),
    ("पता नहीं", BRANCH, "dont_know", None, None),
    ("यह क्या है", BRANCH, "question", None, None),
    ("ನನ್ನ ಹೆಸರು ರವಿ", NAME, "answer", "ರವಿ", None),
    ("ಗೊತ್ತಿಲ್ಲ", BRANCH, "dont_know", None, None),
    ("ಇದು ಏನು", BRANCH, "question", None, None),
]


@pytest.mark.parametrize("text,field,intent,value,target", CASES, ids=[c[0][:40] for c in CASES])
def test_router_cases(text, field, intent, value, target):
    t = route(text, field)
    assert t.intent == intent, (text, t)
    if value is not None:
        assert t.value == value, (text, t)
    if intent in ("answer", "correction"):
        assert t.target_field == (target or field["field_id"]), (text, t)


def test_router_llm_only_breaks_ties_and_never_supplies_values():
    calls = []

    def fake_llm(text, field):
        calls.append(text)
        return "question"

    t = turn_router.route("so the thing is I went to the bank yesterday and they told me something about this box", BRANCH, ALL, llm=fake_llm)
    assert t.intent == "question" and t.value is None and calls
    t2 = turn_router.route("Jayanagar", BRANCH, ALL, llm=fake_llm)
    assert t2.intent == "answer" and t2.value == "Jayanagar" and len(calls) == 1  # confident rules never call the LLM


# ------------------------------------------------------------------ field hygiene
@pytest.mark.parametrize("label", ["70 office use", "For Office Use Only", "For bank use", "To be filled by the Bank", "Official use"])
def test_office_use_fields_are_hidden(label):
    assert is_office_only(F(label))


def test_regular_fields_are_kept_and_duplicates_dropped():
    a, b = F("Branch", fid="a"), F("Branch", fid="b")
    c = {**F("Branch", fid="c"), "page": 2}
    assert [f["field_id"] for f in clean_fields([a, b, c, F("Officer name"), F("70 office use")])] == ["a", "c", "officer_name"]


# ------------------------------------------------------------------ server-owned pointer + transcript replay
class TestFormBot:
    @pytest.fixture(autouse=True)
    def _no_kag(self, monkeypatch):
        from app.services.formdoc import assistant as mod
        monkeypatch.setattr(mod.agent, "answer", lambda *a, **k: {"answer": "", "evidence": [], "insufficient_evidence": True, "grounded": True})

    def say(self, client, user, fid, msg, pending=None, current=None):
        r = client.post(f"/api/forms/{fid}/assistant", json={"message": msg, "pending_field_id": pending, "current_field_id": current},
                        headers=user["headers"])
        assert r.status_code == 200, r.text
        return r.json()

    def test_office_use_field_never_listed_or_asked(self, client, alice):
        fid = ready_form(client, alice, kcc_form_pdf(), "kcc.pdf")
        labels = [f["label"] for f in schema(client, alice, fid)["fields"]]
        assert "Branch" in labels and not any("office" in lab.lower() for lab in labels)

    def test_stale_pending_field_saves_nothing_and_reasks_current(self, client, alice):
        fid = ready_form(client, alice, kcc_form_pdf(), "kcc.pdf")
        g = self.say(client, alice, fid, "")
        branch = g["pending_field_id"]
        r = self.say(client, alice, fid, "Jayanagar", branch)
        to = r["pending_field_id"]
        assert r["field_updates"] == {branch: "Jayanagar"} and r["ask"]["label"] == "To"
        stale = self.say(client, alice, fid, "Koramangala", branch)  # client still thinks "Branch" is displayed
        assert stale["field_updates"] == {} and stale["pending_field_id"] == to and "To" in stale["reply"]

    def test_transcript_replay(self, client, alice):
        """Replays backend/tests/fixtures/kcc_transcript.txt, echoing pending_field_id like the frontend does."""
        fid = ready_form(client, alice, kcc_form_pdf(), "kcc.pdf")
        by_label = {f["label"]: f for f in schema(client, alice, fid)["fields"]}
        last = self.say(client, alice, fid, "")
        asked_labels = [last["ask"]["label"]]
        for line in FIXTURE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or line.startswith("BOT "):
                continue
            if line.startswith("USER:"):
                last = self.say(client, alice, fid, line[5:].strip(), last["pending_field_id"])
                if last.get("ask"):
                    asked_labels.append(last["ask"]["label"])
                continue
            key, _, rest = line[len("EXPECT "):].partition(":") if ":" in line else (line[len("EXPECT "):], "", "")
            key, rest = key.strip(), rest.strip()
            if key.startswith("saved "):
                label, _, value = key[len("saved "):].partition("=") if "=" in key else (key[len("saved "):], "", rest)
                label, value = label.strip(), (value or rest).strip()
                assert last["field_updates"].get(by_label[label]["field_id"]) == value, (line, last["field_updates"], last["reply"])
            elif key == "not_saved":
                assert last["field_updates"] == {}, (line, last["reply"])
            elif key == "asks":
                assert last["ask"] and last["ask"]["label"] == rest, (line, last["reply"])
            elif key == "skipped":
                st = client.get(f"/api/forms/{fid}/review", headers=alice["headers"]).json()
                assert next(i for i in st["items"] if i["label"] == rest)["status"] == "skipped", line
            elif key == "explains":
                assert "asks for" in last["reply"] and all(o in last["reply"] for o in by_label[rest]["options"]), (line, last["reply"])
            elif key == "never_asked":
                assert rest not in asked_labels and rest not in by_label, line
            else:
                raise AssertionError(f"unknown EXPECT line: {line}")

    def test_dont_know_explains_options_then_reasks(self, client, alice):
        fid = ready_form(client, alice, kcc_form_pdf(), "kcc.pdf")
        sel = next(f for f in schema(client, alice, fid)["fields"] if f["label"] == "Select one")
        r = self.say(client, alice, fid, "pata nahi", current=sel["field_id"])
        assert r["field_updates"] == {} and "New Card" in r["reply"] and "Renewal" in r["reply"] and "skip" in r["reply"]
        assert r["ask"]["field_id"] == sel["field_id"] and r["choices"] == ["New Card", "Renewal"]

    def test_correction_updates_other_field_and_returns_to_current(self, client, alice):
        fid = ready_form(client, alice, kcc_form_pdf(), "kcc.pdf")
        g = self.say(client, alice, fid, "")
        r1 = self.say(client, alice, fid, "Jayanagar", g["pending_field_id"])
        r2 = self.say(client, alice, fid, "actually my branch is Koramangala", r1["pending_field_id"])
        assert list(r2["field_updates"].values()) == ["Koramangala"] and r2["ask"]["label"] == "To"

    def test_low_confidence_value_is_read_back_before_saving(self, client, alice):
        fid = ready_form(client, alice, kcc_form_pdf(), "kcc.pdf")
        g = self.say(client, alice, fid, "")
        long = "Jayanagar fourth block near the big temple opposite the old bus stand"
        r = self.say(client, alice, fid, long, g["pending_field_id"])
        assert r["clarification"] is True and r["field_updates"] == {} and "is that right" in r["reply"]
        r2 = self.say(client, alice, fid, "yes")
        assert list(r2["field_updates"].values()) == [long]
