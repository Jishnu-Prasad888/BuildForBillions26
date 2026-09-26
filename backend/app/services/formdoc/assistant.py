"""Conversational helper for one uploaded form.

Privacy rules enforced here:
* Values the citizen provides are parsed and validated by code, never sent to an LLM.
* Only redacted question text, field labels and (optionally) a screen description go to the LLM / KAG.
* OTPs, passwords and PINs are refused and never stored.
* Answers keep FORM OBSERVATIONS (from this document) apart from KNOWLEDGE BASE information (KAG, with citations).
* Nothing is guessed: ambiguous answers trigger a clarification question.
"""
from __future__ import annotations

import logging
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.kag import agent
from app.models import Form, FormAssistanceSession, FormField, FormValue, User
from app.services.formdoc import service
from app.services.formdoc.values import ValueError_, is_secret_field, match_options, mask, to_display, validate_value
from app.services.redact import contains_secret, redact

log = logging.getLogger("forms.assistant")

UNVERIFIED = "I couldn't verify this from the uploaded form or available official sources."
QUESTION_RE = re.compile(r"\?|^\s*(what|where|which|how|why|who|when|do i|does|is|are|can|could|should|explain|tell me|meaning of)\b", re.I)
SKIP_RE = re.compile(r"^\s*(skip|later|not now|pass|i (do not|don't|dont) know|dont know|don't know|no idea|not sure|next)\b", re.I)
BLANK_RE = re.compile(r"^\s*(leave (it|this)( blank| empty)?|leave blank|not applicable|n/?a|nothing|none|no value)\s*[.!]*$", re.I)
BOTH_RE = re.compile(r"\b(both|all( of them| of these)?|either|any( of them| one)?|every one)\b", re.I)
SAME_RE = re.compile(r"\b(same as (before|last time|earlier|previous)|same (address|number|one)|as before|use (my )?(saved|profile|previous|earlier)|already (gave|given|told))\b", re.I)
SUMMARY_RE = re.compile(r"how many|which fields|what fields|list (of )?(the )?fields|what('s| is) (left|missing|pending|remaining)|progress|how much (is )?(left|done)", re.I)
SECRET_ASK_RE = re.compile(r"\b(otp|one[- ]time password|password|pin number|cvv)\b", re.I)


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


class FormAssistant:
    def __init__(self, db: Session, user: User, form: Form, session: FormAssistanceSession):
        self.db, self.user, self.form, self.session = db, user, form, session
        self.fields = service.load_fields(db, form)
        self.by_id = {f["field_id"]: f for f in self.fields}
        self.rows = service.load_value_rows(db, form)
        self.values, self.skipped, self.blank = service.split_values(self.rows)
        self.state = dict(session.state or {})
        self.updates: dict[str, object] = {}

    # ------------------------------------------------------------------ helpers
    def _save_state(self) -> None:
        self.state["history"] = (self.state.get("history") or [])[-40:]
        self.session.state = dict(self.state)

    def _push(self, role: str, text: str) -> None:
        self.state.setdefault("history", []).append({"role": role, "text": text})

    def _reload(self) -> None:
        self.rows = service.load_value_rows(self.db, self.form)
        self.values, self.skipped, self.blank = service.split_values(self.rows)

    def _summary(self) -> dict:
        return service.summarize(self.fields, self.values, self.skipped, self.blank, bool(self.state.get("clarify")))

    def _next(self, after: str | None) -> dict | None:
        return service.next_missing(self.fields, self.values, self.skipped, self.blank, after)

    def _ask_payload(self, f: dict | None) -> dict | None:
        if f is None:
            return None
        return {"field_id": f["field_id"], "label": f["label"], "type": f["type"], "options": f["options"]}

    def _ask_text(self, f: dict) -> str:
        label = f["label"]
        if f["type"] == "choice":
            multi = f["meta"].get("multiple")
            return f"For “{label}”, the form offers: " + ", ".join(f["options"]) + (". Which ones apply to you?" if multi else ". Which one applies to you?")
        if f["type"] == "checkbox":
            return f"The form has a box: “{label}”. Should it be ticked? (yes / no)"
        if f["type"] == "date":
            return f"I found a field called “{label}”. What date should I enter? (for example 25/12/1990)"
        if f["type"] == "phone":
            return f"I found a field called “{label}”. What is the 10-digit number?"
        return f"I found a field called “{label}”. Do you know it? Tell me the value, or say “skip” to come back to it later."

    def _finish_reply(self, sections: list[dict], ask_after: str | None, *, ask: dict | None = None, choices: list[str] | None = None,
                      clarification: bool = False, evidence: list | None = None, reask: bool = True, hist: str | None = None) -> dict:
        """Add the next question (unless a clarification is open) and build the response."""
        nxt = ask
        if nxt is None and not clarification and reask:
            nxt = self._ask_payload(self._next(ask_after))
            if nxt is not None:
                self.state["asking"] = nxt["field_id"]
                sections.append({"kind": "assistant", "text": self._ask_text(self.by_id[nxt["field_id"]])})
                if nxt["type"] == "choice":
                    choices = nxt["options"]
            else:
                self.state["asking"] = None
                sm = self._summary()
                if sm["required_missing"] == 0:
                    sections.append({"kind": "assistant", "text": "All the information I need is in. Open **Review** to check every answer, then generate your PDF."})
                else:
                    sections.append({"kind": "assistant", "text": f"{sm['required_missing']} required field(s) still need an answer."})
        elif nxt is not None:
            self.state["asking"] = nxt["field_id"]
        reply = "\n\n".join(s["text"] for s in sections)
        # The stored transcript never contains values the citizen entered: those live only in form_values.
        self._push("assistant", hist if hist is not None else redact(reply))
        self._save_state()
        self.db.commit()
        return {"reply": reply, "sections": sections, "ask": self._ask_payload(self.by_id.get(self.state.get("asking") or "")) if not clarification else None,
                "choices": choices, "clarification": clarification, "field_updates": self.updates, "summary": self._summary(),
                "evidence": evidence or [], "session_id": self.session.id}

    # ------------------------------------------------------------------ entry points
    def greet(self) -> dict:
        sm = self._summary()
        text = (f"I found **{sm['detected']} fields** in “{self.form.original_filename}”. "
                + (f"{sm['pending']} still need information." if sm["pending"] else "Every field already has an answer.")
                + " I'll ask about them one at a time, and you can ask me what any field means. I only fill what you tell me — you review everything before the PDF is made.")
        sections = [{"kind": "assistant", "text": text}]
        low = [f for f in self.fields if f["confidence"] < 0.6 and f["type"] != "signature"]
        if low:
            sections.append({"kind": "assistant", "text": f"I couldn't confidently identify {len(low)} field(s). You can fix their names in the AutoFill panel."})
        if self.form.analysis.get("ocr_pages"):
            sections.append({"kind": "assistant", "text": "Some pages were read with OCR, so please double-check the field names."})
        return self._finish_reply(sections, None)

    def handle(self, message: str, current_field_id: str | None, frame_b64: str | None, language: str) -> dict:
        text = (message or "").strip()
        if not text:
            return self.greet()
        if current_field_id and current_field_id not in self.by_id:
            current_field_id = None
        if contains_secret(text):
            self._push("user", "[message withheld: contained a secret]")
            return self._finish_reply([{"kind": "assistant", "text": "That looks like an OTP, PIN or password. I never need those and I haven't kept it. Please don't share them with anyone, including me."}], self.state.get("asking"), reask=False)

        clar = self.state.get("clarify")
        if clar:
            out = self._resolve_clarification(text, clar)
            if out is not None:
                return out
        if SECRET_ASK_RE.search(text) and re.search(r"\b(enter|send|share|give|type|fill|is|my)\b", text, re.I) and not QUESTION_RE.search(text):
            self._push("user", redact(text))
            return self._finish_reply([{"kind": "assistant", "text": "I never handle OTPs, passwords or PINs. Please keep them to yourself."}], self.state.get("asking"), reask=False)
        if QUESTION_RE.search(text) and not (self.state.get("asking") and self.by_id.get(self.state["asking"], {}).get("type") == "choice" and not text.rstrip().endswith("?") and match_options(self.by_id[self.state["asking"]]["options"], text)):
            return self._answer_question(text, current_field_id, frame_b64, language)

        target = self.by_id.get(current_field_id or "") or self.by_id.get(self.state.get("asking") or "")
        self._push("user", "(answer)")
        if target is None:
            return self._finish_reply([{"kind": "assistant", "text": "I'm not sure which field that is for. Tell me a field name, or ask me a question about the form."}], self.state.get("asking"))
        if SKIP_RE.match(text):
            service.set_marker(self.db, self.form, target["field_id"], "skipped")
            self._reload()
            return self._finish_reply([{"kind": "assistant", "text": f"No problem — I'll leave “{target['label']}” for later. You can add a note about it in My Notes."}], target["field_id"])
        if BLANK_RE.match(text):
            service.set_marker(self.db, self.form, target["field_id"], "blank")
            self._reload()
            return self._finish_reply([{"kind": "assistant", "text": f"Okay, “{target['label']}” will be left blank."}], target["field_id"])
        if SAME_RE.search(text):
            return self._previous_value(target)
        if target["type"] == "choice" and BOTH_RE.search(text) and not target["meta"].get("multiple") and len(match_options(target["options"], text)) != 1:
            self.state["clarify"] = {"field_id": target["field_id"], "kind": "choice"}
            return self._finish_reply([{"kind": "assistant", "text": "The form allows only one option here. Which one would you like to use?"}], None, ask=self._ask_payload(target),
                                      choices=target["options"], clarification=True)
        return self._store(target, text)

    # ------------------------------------------------------------------ storing values
    def _store(self, target: dict, raw, source: str = "assistant", note: str = "") -> dict:
        try:
            v = validate_value(target, raw, service.sibling_context(self.fields, self.values))
        except ValueError_ as exc:
            if exc.options and target["type"] == "choice":
                self.state["clarify"] = {"field_id": target["field_id"], "kind": "choice"}
                msg = "More than one option matches what you said. Which one do you mean?" if len(exc.options) < len(target["options"]) else "I couldn't match that to an option on the form. Which one applies?"
                return self._finish_reply([{"kind": "assistant", "text": msg}], None, ask=self._ask_payload(target), choices=exc.options, clarification=True)
            return self._finish_reply([{"kind": "assistant", "text": f"{exc} Please try again, or say “skip”."}], None, ask=self._ask_payload(target))
        service.set_value(self.db, self.form, target["field_id"], v, source)
        self.updates[target["field_id"]] = v
        self.state.pop("clarify", None)
        self._reload()
        shown = mask(target, v)
        hist = f"Got it — “{target['label']}” saved. " + (self._ask_text(self.by_id[nxt["field_id"]]) if (nxt := self._next(target["field_id"])) else "")
        return self._finish_reply([{"kind": "assistant", "text": f"Got it — “{target['label']}”: **{shown}**. {note}".strip()}], target["field_id"], hist=hist.strip())

    def _resolve_clarification(self, text: str, clar: dict) -> dict | None:
        target = self.by_id.get(clar.get("field_id", ""))
        if target is None:
            self.state.pop("clarify", None)
            return None
        if SKIP_RE.match(text):
            self.state.pop("clarify", None)
            self._push("user", "(skip)")
            service.set_marker(self.db, self.form, target["field_id"], "skipped")
            self._reload()
            return self._finish_reply([{"kind": "assistant", "text": f"Okay, I'll leave “{target['label']}” for later."}], target["field_id"])
        self._push("user", "(answer)")
        if clar["kind"] == "previous":
            cands = self._previous_candidates(target)
            picked = None
            m = re.fullmatch(r"\s*(?:option\s*)?(\d{1,2})\s*[.)]?\s*", text)
            words = {"first": 0, "second": 1, "third": 2}
            if m and 0 < int(m.group(1)) <= len(cands):
                picked = cands[int(m.group(1)) - 1]
            else:
                for w, i in words.items():
                    if re.search(rf"\b{w}\b", text, re.I) and i < len(cands):
                        picked = cands[i]
                hits = [c for c in cands if _norm(text) and _norm(text) in _norm(c["value"])]
                if picked is None and len(hits) == 1:
                    picked = hits[0]
            if picked is not None:
                return self._store(target, picked["value"], source="profile" if picked["origin"] == "profile" else "assistant")
            if re.search(r"\d|[a-z]{4,}", text, re.I) and not QUESTION_RE.search(text) and len(text) > 12:
                self.state.pop("clarify", None)
                return self._store(target, text)
            return self._finish_reply([{"kind": "assistant", "text": "Please tell me which one to use (for example “1”), or type the value you want."}], None,
                                      ask=self._ask_payload(target), choices=[f"{i}. {mask(target, c['value'])}" for i, c in enumerate(cands, 1)], clarification=True)
        # choice
        m = match_options(target["options"], text)
        if len(m) == 1:
            return self._store(target, m[0])
        if QUESTION_RE.search(text):
            return None
        return self._finish_reply([{"kind": "assistant", "text": "I need exactly one of these options. Which would you like to use?"}], None, ask=self._ask_payload(target),
                                  choices=target["options"], clarification=True)

    # ------------------------------------------------------------------ "same as before"
    def _previous_candidates(self, target: dict) -> list[dict]:
        cands: list[dict] = []
        seen: set[str] = set()

        def add(v: str, origin: str) -> None:
            k = _norm(v)
            if k and k not in seen:
                seen.add(k)
                cands.append({"value": v, "origin": origin})

        prof = self.user.profile or {}
        label = target["label"].lower()
        if target["type"] == "multiline" or "address" in label:
            if prof.get("address"):  # only a full address the citizen saved; never assembled from district/state fragments
                add(str(prof["address"]), "profile")
        elif target["type"] == "phone" and prof.get("phone"):
            add(str(prof["phone"]), "profile")
        rows = self.db.execute(
            select(FormValue, FormField).join(FormField, (FormField.form_id == FormValue.form_id) & (FormField.field_id == FormValue.field_id))
            .where(FormValue.user_id == self.user.id, FormField.user_id == self.user.id, FormValue.form_id != self.form.id)
            .order_by(FormValue.updated_at.desc()).limit(200)).all()
        for val, fld in rows:
            v = (val.value or {}).get("v")
            if not isinstance(v, str) or fld.type != target["type"]:
                continue
            same_kind = _norm(fld.label) == _norm(target["label"]) or ("address" in fld.label.lower() and "address" in label)
            if same_kind:
                add(v, "earlier_form")
        return cands

    def _previous_value(self, target: dict) -> dict:
        cands = self._previous_candidates(target)
        if not cands:
            return self._finish_reply([{"kind": "assistant", "text": f"I don't have an earlier value for “{target['label']}”. Please type it."}], None, ask=self._ask_payload(target))
        if len(cands) == 1:
            return self._store(target, cands[0]["value"], source="profile" if cands[0]["origin"] == "profile" else "assistant",
                               note="I used the one I had on record — change it in AutoFill if that's wrong.")
        self.state["clarify"] = {"field_id": target["field_id"], "kind": "previous"}
        listing = "\n".join(f"{i}. {c['value']}" for i, c in enumerate(cands, 1))
        return self._finish_reply([{"kind": "assistant", "text": f"I found more than one value for “{target['label']}”. Which one should I use?\n\n{listing}"}], None,
                                  ask=self._ask_payload(target), choices=[str(i) for i in range(1, len(cands) + 1)], clarification=True,
                                  hist=f"I found more than one value for “{target['label']}”. Which one should I use?")

    # ------------------------------------------------------------------ questions
    def _focus_field(self, text: str, current_field_id: str | None) -> dict | None:
        if current_field_id and current_field_id in self.by_id:
            return self.by_id[current_field_id]
        low = _norm(text)
        best, score = None, 0
        for f in self.fields:
            words = [w for w in _norm(f["label"]).split() if len(w) > 2]
            if not words:
                continue
            s = sum(1 for w in words if re.search(rf"\b{re.escape(w)}", low))
            if s == len(words) and s > score:
                best, score = f, s
        return best or self.by_id.get(self.state.get("asking") or "")

    def _observe(self, f: dict) -> str:
        bits = [f"The uploaded form contains a field called “{f['label']}” on page {f['page']}"]
        kind = {"choice": "a choice field", "checkbox": "a tick box", "signature": "a signature area", "date": "a date field", "multiline": "a multi-line field"}.get(f["type"])
        if kind:
            bits[0] += f" ({kind})"
        text = bits[0] + "."
        if f["options"]:
            text += " Its options are: " + ", ".join(f["options"]) + "."
        if f["description"]:
            text += f" The form adds: “{f['description']}”."
        text += " It looks " + ("required." if f["required"] else "optional.")
        if f["confidence"] < 0.6:
            text += " I'm not fully sure I identified this field correctly."
        return text

    def _screen_text(self, frame_b64: str, language: str) -> str:
        """Describe a shared-screen frame in redacted text. The frame is used in memory and never stored."""
        try:
            from app.services.ai import get_ai
            from app.services import ocr

            ai = get_ai()
            if ai.vision_available():
                out = ai.generate([{"role": "user", "content": "List the form field labels and any instructions visible in this screenshot. Plain text only."}], images=[frame_b64])
                if out:
                    return redact(out)[:1500]
            res = ocr.read_screen(frame_b64, self.session.language)
            if res:
                return res["visible_text"][:1500]
        except Exception as exc:  # noqa: BLE001
            log.info("Screen frame not analysed: %s", type(exc).__name__)
        return ""

    def _answer_question(self, text: str, current_field_id: str | None, frame_b64: str | None, language: str) -> dict:
        q = redact(text)
        self._push("user", q)
        sections: list[dict] = []
        evidence: list = []
        if SUMMARY_RE.search(text):
            sm = self._summary()
            missing = [f["label"] for f in self.fields if sm["status"][f["field_id"]] in ("missing", "skipped")]
            body = f"The form has {sm['detected']} fields; {sm['completed']} are filled and {sm['pending']} still need information."
            if missing:
                body += " Still needed: " + ", ".join(f"“{m}”" for m in missing[:10]) + ("…" if len(missing) > 10 else ".")
            sections.append({"kind": "form_observation", "text": body})
            return self._finish_reply(sections, self.state.get("asking"), reask=False)

        focus = self._focus_field(text, current_field_id)
        if focus:
            sections.append({"kind": "form_observation", "text": self._observe(focus)})
        ctx = "Uploaded form fields: " + "; ".join(f"{f['label']} ({f['type']})" for f in self.fields[:60])
        if focus:
            ctx += f"\nThe citizen is asking about the field: {focus['label']}"
        if frame_b64:
            screen = self._screen_text(frame_b64, language)
            if screen:
                ctx += "\nText visible on the citizen's screen (from a shared frame):\n" + screen
        query = f"{q} (form field: {focus['label']})" if focus else q
        knowledge = None
        try:
            res = agent.answer(self.db, query, language if language in ("en", "hi", "kn") else None, extra_context=ctx, extra_query=focus["label"] if focus else "")
            if res and res.get("evidence") and not res.get("insufficient_evidence") and res.get("grounded"):
                knowledge = res
        except Exception as exc:  # noqa: BLE001
            log.warning("KAG lookup failed: %s", type(exc).__name__)
        if knowledge:
            sections.append({"kind": "knowledge", "text": knowledge["answer"], "evidence": knowledge["evidence"]})
            evidence = knowledge["evidence"]
        else:
            sections.append({"kind": "assistant", "text": UNVERIFIED})
        return self._finish_reply(sections, None, ask=None, evidence=evidence, reask=False) if not self.state.get("asking") else self._with_reask(sections, evidence)

    def _with_reask(self, sections: list[dict], evidence: list) -> dict:
        asking = self.by_id.get(self.state.get("asking") or "")
        if asking is not None and service.field_status(asking, self.values, self.skipped, self.blank) in ("missing", "skipped"):
            sections.append({"kind": "assistant", "text": "Back to the form: " + self._ask_text(asking)})
            return self._finish_reply(sections, None, ask=self._ask_payload(asking), evidence=evidence,
                                      choices=asking["options"] if asking["type"] == "choice" else None)
        return self._finish_reply(sections, asking["field_id"] if asking else None, evidence=evidence)
