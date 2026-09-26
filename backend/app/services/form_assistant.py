"""Screen-aware, field-by-field form assistance.

Inputs each turn: the user's utterance (voice transcript or typed), plus the
*screen context* captured by the browser: the visible form structure (labels,
values, required markers, focused field) and optionally a captured frame that is
sent to a vision model when VISION_MODEL is configured. Frames are never stored.

Outputs: a reply, field updates for the form, progress, AI notes, suggested
user notes (never written without the user's consent) and evidence.
"""
from __future__ import annotations

import re

from sqlalchemy.orm import Session

from app.kag import agent
from app.kag.agent import _best_sentences
from app.kag.query_understanding import QueryContext, understand
from app.kag.retriever import retrieve
from app.models import Application, Conversation, Message, User
from app.models.common import utcnow
from app.services.ai import get_ai
from app.services.form_templates import f, fmt
from app.services.forms import (
    NO, YES, all_fields, compute_status, field_label, get_form, is_filled, mask, option_display, parse_value,
    resolve_field, section_title,
)
from app.services.notes import WALLET_LABELS, build_ai_notes, wallet_types
from app.services.redact import contains_secret, redact

QUESTION_RE = re.compile(
    r"\?|^\s*(what|where|which|how|why|who|when|do|does|is|are|can|could|should|will|explain|tell me)\b|"
    r"क्या|कहाँ|कहां|कैसे|क्यों|कौन|मतलब|ಏನು|ಎಲ್ಲಿ|ಹೇಗೆ|ಯಾಕೆ|ಯಾವ|ಬೇಕೆ|ಬೇಕಾ|ಅರ್ಥ", re.I)
DEICTIC_RE = re.compile(r"\b(here|this field|this box|this one|this)\b|यहाँ|यहां|इसमें|ಇಲ್ಲಿ|ಇದರಲ್ಲಿ", re.I)
SKIP_RE = re.compile(r"\b(skip|later|don'?t have|do not have|don'?t know|not sure|not now|next field|come back)\b|बाद में|पता नहीं|मालूम नहीं|छोड़|ಗೊತ್ತಿಲ್ಲ|ನಂತರ|ಬಿಟ್ಟು|ಮುಂದಿನದು", re.I)
SWITCH_RE = re.compile(r"\b(change|edit|correct|update|go to|go back to|fix)\b|बदल|सुधार|ಬದಲ|ತಿದ್ದ", re.I)
REVIEW_RE = re.compile(r"\b(review|submit|finish|finished|done|complete)\b|समीक्षा|जमा|ಸಲ್ಲಿಸ|ಪರಿಶೀಲನೆ", re.I)
FILLER_RE = re.compile(r"\b(what should i (put|enter|write|fill)( here)?|what do i (put|enter|write|fill)( here)?)\b", re.I)


class FormAssistant:
    def __init__(self, db: Session, user: User, conv: Conversation, app: Application):
        self.db, self.user, self.conv, self.app = db, user, conv, app
        self.form = get_form(app.form_id)
        if not self.form:
            raise ValueError("This application has no fillable demo form")
        self.lang = conv.language or "en"
        self.state = dict(conv.state or {})
        self.values = dict(app.form_data or {})
        self.fields = all_fields(self.form)
        self.by_id = {x["id"]: x for x in self.fields}
        self.evidence: list[dict] = []
        self.suggestions: list[dict] = []
        self.updates: dict = {}
        self.questions: list[str] = []
        self.action: str | None = None
        self.pending: dict | None = None
        self.mode = "rule"

    # ------------------------------------------------------------------ helpers
    @property
    def skipped(self) -> set[str]:
        return set(self.state.get("skipped", []))

    def _field(self, fid: str) -> dict:
        return resolve_field(self.by_id[fid], self.values)

    def _label(self, fid: str) -> str:
        return field_label(self._field(fid), self.lang)

    def _next_field_id(self, after: str | None = None, include_skipped: bool = False) -> str | None:
        ids = [x["id"] for x in self.fields]
        start = ids.index(after) + 1 if after in ids else 0
        order = ids[start:] + ids[:start]
        for fid in order:
            if not is_filled(self.by_id[fid], self.values) and (include_skipped or fid not in self.skipped):
                return fid
        return None

    def _add_evidence(self, items: list[dict]) -> None:
        seen = {e["id"] for e in self.evidence}
        for e in items:
            if e["id"] not in seen:
                self.evidence.append(e)
                seen.add(e["id"])

    # ------------------------------------------------------------ KAG field hint
    def field_hint(self, fid: str, sentences: int = 1) -> str:
        fld = self._field(fid)
        key = f"{fid}:{fld['label']}:{self.lang}:{sentences}"
        cache = self.state.setdefault("hints", {})
        if key in cache:
            self._add_evidence(cache[key]["evidence"])
            return cache[key]["text"]
        q = QueryContext(question=fld.get("help_query") or fld["label"], language="en",
                         retrieval_query=f"{fld.get('help_query', '')} {fld['label']}", intent="general",
                         scheme_codes=[self.app.scheme_code])
        result = retrieve(self.db, q, top_k=6)
        label_words = {w for w in re.findall(r"\w+", fld["label"].lower()) if len(w) > 2}
        best, best_score = None, -1.0
        for c in result.chunks:
            if not c.meta.get("relevant"):
                continue
            sec = set(re.findall(r"\w+", (c.meta.get("section") or "").lower()))
            s = c.score * 100 + 3 * len(label_words & sec)
            if s > best_score:
                best, best_score = c, s
        if not best:
            cache[key] = {"text": "", "evidence": []}
            return ""
        text = " ".join(_best_sentences(best, q.retrieval_query + " " + " ".join(label_words), sentences))
        if self.lang != "en":
            tr = get_ai().generate([
                {"role": "system", "content": "Translate to simple, friendly " + {"hi": "Hindi", "kn": "Kannada"}[self.lang] +
                 ". Keep numbers, codes and examples unchanged. Output only the translation."},
                {"role": "user", "content": text},
            ])
            text = tr.strip() if tr else text + f("english_hint", self.lang)
        text = f"{text} [{best.id}] "
        ev = [best.as_dict()]
        cache[key] = {"text": text, "evidence": ev}
        self._add_evidence(ev)
        return text

    # ---------------------------------------------------------------- asking
    def ask(self, fid: str | None, after_choice: bool = False, editing: bool = False) -> str:
        if fid is None:
            return self._completion_message()
        self.state["current_field"] = fid
        fld = self._field(fid)
        label = field_label(fld, self.lang)
        if fld["type"] == "checkbox":
            return f("ask_declaration", self.lang)
        prof_key = fld.get("profile_key")
        prof_val = (self.user.full_name if prof_key == "full_name" else (self.user.profile or {}).get(prof_key)) if prof_key else None
        if prof_val and not is_filled(fld, self.values) and not editing:
            self.state["suggestion"] = {"field": fid, "value": prof_val}
            return f"{f('ask_label', self.lang, label=label)} {f('suggest_profile', self.lang, value=prof_val)}"
        if fid == "id_type":
            have = wallet_types(self.db, self.user.id)
            wallet = ""
            for wt in ("AADHAAR", "DRIVING_LICENCE"):
                if wt in have:
                    wallet = f("wallet_has", self.lang, doc=WALLET_LABELS[wt])
                    break
            return f("ask_id_type", self.lang, options=" / ".join(option_display(fld, self.lang)), wallet=wallet)
        hint = self.field_hint(fid)
        if after_choice:
            return f("ask_after_choice", self.lang, label=label, hint=hint)
        if fld["type"] == "select":
            return f("ask_select", self.lang, label=label, hint=hint, options=" / ".join(option_display(fld, self.lang)))
        return f("ask_text", self.lang, label=label, hint=hint)

    def _completion_message(self) -> str:
        pending_req = [x["id"] for x in self.fields if x.get("required") and not is_filled(x, self.values)]
        if not pending_req:
            self.state["current_field"] = None
            self.action = "open_review"
            return f("all_done", self.lang)
        first = pending_req[0]
        self.state["current_field"] = first
        return f("pending_left", self.lang, fields=", ".join(self._label(x) for x in pending_req), label=self._label(first))

    # ---------------------------------------------------------------- filling
    def propose(self, fid: str, value) -> str:
        """Never write a value the user hasn't approved: ask first, fill on 'yes'."""
        fld = self._field(fid)
        self.state["current_field"] = fid
        self.state["pending_fill"] = {"field": fid, "value": value}
        self.pending = {"field_id": fid, "label": field_label(fld, self.lang), "display": mask(fld, value)}
        return f("confirm_fill", self.lang, label=field_label(fld, self.lang), value=mask(fld, value))

    def fill(self, fid: str, value) -> str:
        prev_section = self.by_id[fid]["section_id"]
        self.values[fid] = value
        self.updates[fid] = value
        sk = self.skipped - {fid}
        self.state["skipped"] = sorted(sk)
        self.state.pop("suggestion", None)
        self.state.pop("pending_fill", None)
        self.state.pop("editing", None)
        fld = self._field(fid)
        msg = f("filled", self.lang, value=mask(fld, value), label=field_label(fld, self.lang))
        nxt = self._next_field_id(after=fid)
        section = next(s for s in self.form["sections"] if s["id"] == prev_section)
        if all(is_filled(x, self.values) for x in section["fields"]):
            msg += " " + f("section_done", self.lang, section=section_title(section, self.lang))
            self.app.last_completed_section = section["title"]
        return msg + "\n\n" + self.ask(nxt, after_choice=(fid == "id_type"))

    def llm_extract(self, fld: dict, text: str):
        if fld["type"] in ("checkbox",):
            return None
        out = get_ai().generate_json([
            {"role": "system", "content": "Extract the value for one government form field from the citizen's reply. "
             "Return JSON {\"value\": <string or null>}. Return null if the reply does not contain a value. Never guess."},
            {"role": "user", "content": f"Field: {fld['label']} (type: {fld['type']}"
             + (f", options: {fld['options']}" if fld.get("options") else "") + f")\nReply: {text}"},
        ])
        if out and out.get("value"):
            v, err = parse_value(fld, str(out["value"]), self.values)
            return v if not err else None
        return None

    # ---------------------------------------------------------------- screen
    def screen_summary(self, screen: dict | None, analyse_frame: bool) -> dict:
        screen = screen or {}
        visible = screen.get("visible_fields") or []
        summary = {
            "source": "form-structure",
            "fields_detected": len(visible),
            "required_detected": sum(1 for v in visible if v.get("required")),
            "empty_required": [v.get("label") for v in visible if v.get("required") and not v.get("filled")][:8],
            "buttons": screen.get("buttons") or [],
            "warnings": screen.get("warnings") or [],
            "focused_field": screen.get("focused_field_id"),
            "frame_received": bool(screen.get("frame")),
            "vision": None,
        }
        if analyse_frame and screen.get("frame") and get_ai().vision_available():
            out = get_ai().generate_json([
                {"role": "system", "content": "You read screenshots of government forms. Return JSON with keys: "
                 "fields (list of {label, required, has_value}), options (list), instructions (list), buttons (list), warnings (list)."},
                {"role": "user", "content": "Describe the visible form on this screen."},
            ], images=[screen["frame"]])
            if out:
                summary["vision"] = out
                summary["source"] = "vision+form-structure"
                self.state["vision"] = out
        elif self.state.get("vision"):
            summary["vision"] = self.state["vision"]
        return summary

    def screen_context_text(self, fid: str, screen: dict | None) -> str:
        fld = self._field(fid)
        lines = ["SCREEN CONTEXT (what the citizen currently sees; not an official source):",
                 f"Form: {self.form['title']} ({self.form.get('authority', '')})",
                 f"Field in question: {fld['label']} (type {fld['type']}"
                 + (f"; options: {', '.join(fld['options'])}" if fld.get("options") else "") + ")"]
        for v in (screen or {}).get("visible_fields", [])[:25]:
            lines.append(f"- visible field: {v.get('label')}{' *required' if v.get('required') else ''}{' [filled]' if v.get('filled') else ''}")
        if self.state.get("vision"):
            lines.append(f"Vision model reading of the screenshot: {str(self.state['vision'])[:1200]}")
        return "\n".join(lines)

    # ---------------------------------------------------------------- main turn
    def start(self, screen: dict | None) -> dict:
        status, progress = compute_status(self.form, self.values, self.skipped)
        n_fields = len(self.fields)
        n_req = sum(1 for x in self.fields if x.get("required"))
        scr = self.screen_summary(screen, analyse_frame=True)
        title = self.form.get("titles", {}).get(self.lang) or self.form["title"]
        nxt = self._next_field_id(include_skipped=True)
        if progress > 0 and self.app.last_completed_section and nxt:
            nsec = self.by_id[nxt]
            msg = f("greet_resume", self.lang, form=title, progress=progress,
                    last=self._section_title_by_name(self.app.last_completed_section), next=section_title(nsec, self.lang))
        else:
            msg = f("greet_new", self.lang, form=title, sections=len(self.form["sections"]), fields=n_fields, required=n_req)
        if scr["fields_detected"]:
            msg += " " + f("screen_seen", self.lang, n=scr["fields_detected"])
        msg += "\n\n" + self.ask(nxt)
        return self._finish(msg, None, scr)

    def _section_title_by_name(self, name: str) -> str:
        for s in self.form["sections"]:
            if s["title"] == name:
                return section_title(s, self.lang)
        return name

    def handle(self, text: str, screen: dict | None) -> dict:
        text = (text or "").strip()
        # sync values the user typed directly into the form
        if screen and isinstance(screen.get("values"), dict):
            for k, v in screen["values"].items():
                if k in self.by_id and v not in (None, ""):
                    self.values[k] = v
        cur_id = self.state.get("current_field")
        editing = self.state.get("editing") == cur_id
        if not cur_id or cur_id not in self.by_id or (is_filled(self.by_id[cur_id], self.values) and not editing):
            cur_id = self._next_field_id(after=None, include_skipped=True) if not cur_id else self._next_field_id(after=cur_id, include_skipped=True)
        is_question = bool(QUESTION_RE.search(text)) or bool(FILLER_RE.search(text))
        scr = self.screen_summary(screen, analyse_frame=is_question)
        focused = (screen or {}).get("focused_field_id")
        low = text.lower()

        if cur_id is None and not is_question:
            return self._finish(self._completion_message(), text, scr)

        if contains_secret(text) and not is_question:
            return self._finish(f("no_secrets", self.lang), text, scr)

        # 0) approve / decline a value the assistant proposed to fill
        pend = self.state.get("pending_fill")
        if pend and not is_question:
            self.state.pop("pending_fill")
            if pend["field"] in self.by_id:
                if re.search(YES, low):
                    return self._finish(self.fill(pend["field"], pend["value"]), text, scr)
                if re.fullmatch(NO + r"[\s.!]*", low):
                    self.state["current_field"] = pend["field"]
                    return self._finish(f("fill_declined", self.lang, label=self._label(pend["field"])), text, scr)

        sugg = self.state.get("suggestion")
        # 1) accept / reject a profile suggestion
        if sugg and sugg.get("field") == cur_id and not is_question:
            if re.search(YES, low):
                fld = self._field(cur_id)
                v, err = parse_value(fld, str(sugg["value"]), self.values)
                return self._finish(self.fill(cur_id, v if not err else sugg["value"]), text, scr)
            if re.fullmatch(NO + r"[\s.!]*", low):
                self.state.pop("suggestion", None)
                return self._finish(f("ask_again", self.lang, label=self._label(cur_id)), text, scr)

        # 2) skip
        if SKIP_RE.search(text) and cur_id and not is_question:
            lbl = self._label(cur_id)
            self.state["skipped"] = sorted(self.skipped | {cur_id})
            self.state.pop("suggestion", None)
            self.suggestions.append({"content": f("note_find", self.lang, label=lbl), "item_type": "todo"})
            msg = f("skipped", self.lang, label=lbl) + "\n\n" + self.ask(self._next_field_id(after=cur_id))
            return self._finish(msg, text, scr)

        # 3) switch to another field
        if SWITCH_RE.search(text):
            target = self._match_field(text)
            if target:
                self.state.pop("suggestion", None)
                self.state["current_field"] = target
                self.state["editing"] = target
                return self._finish(f("switched", self.lang, label=self._label(target)) + " " + self.ask(target, editing=True), text, scr)

        # 4) review / done
        if REVIEW_RE.search(text) and len(text.split()) <= 6 and not is_question:
            return self._finish(self._completion_message(), text, scr)

        # 5) question -> grounded explanation (KAG + screen context)
        if is_question:
            if focused in self.by_id and (DEICTIC_RE.search(text) or FILLER_RE.search(text)):
                target = focused
            else:
                target = self._match_field(text, strict=True) or cur_id
            return self._finish(self.explain(text, target, screen, reask=cur_id), text, scr)

        # 6) treat as an answer for the current field
        fld = self._field(cur_id)
        value, err = parse_value(fld, text, self.values)
        if err and err not in ("declaration_self", "id_type_first"):
            llm_v = self.llm_extract(fld, text)
            if llm_v is not None:
                value, err = llm_v, None
        if err:
            if err == "declaration_self":
                return self._finish(f("declaration_self", self.lang), text, scr)
            opts = " / ".join(option_display(fld, self.lang)) if fld.get("options") else ""
            return self._finish(f("invalid", self.lang, label=field_label(fld, self.lang), format=fmt(err, self.lang, options=opts)), text, scr)
        return self._finish(self.propose(cur_id, value), text, scr)

    GENERIC = {"name", "number", "date", "details", "code", "type", "information", "given", "true", "declare", "applicant",
               "affected", "land", "crop", "damage", "acres"}

    def _match_field(self, text: str, strict: bool = False) -> str | None:
        low = text.lower()
        toks = set(re.findall(r"\w+", low))
        best, score = None, 0
        for x in self.fields:
            fr = resolve_field(x, self.values)
            words = {w for w in re.findall(r"\w+", fr["label"].lower()) if len(w) > 3}
            words |= {w for w in re.findall(r"\w+", field_label(fr, self.lang).lower()) if len(w) > 2}
            if strict:
                words -= self.GENERIC
            s = sum(1 for w in words if w in toks or (not w.isascii() and w in low))
            if s > score:
                best, score = x["id"], s
        return best

    def explain(self, question: str, fid: str | None, screen: dict | None, reask: str | None = None) -> str:
        q = understand(question, self.lang, [self.app.scheme_code])
        field_q = fid is not None and (q.intent in ("general", "why") or bool(DEICTIC_RE.search(question)) or bool(FILLER_RE.search(question)))
        fld = self._field(fid) if fid else None
        res = agent.answer(
            self.db, question, self.lang, context_schemes=[self.app.scheme_code], query=q,
            extra_context=self.screen_context_text(fid, screen) if fid else "",
            extra_query=(fld.get("help_query", "") + " " + fld["label"]) if (fld and field_q) else "",
        )
        self.mode = res["mode"]
        insufficient = bool(res.get("insufficient_evidence"))
        if res["mode"] == "llm" or not field_q:
            msg = res["answer"]
            self._add_evidence(res["evidence"])
        else:
            # deterministic field explanation grounded in the form guide (no LLM available)
            hint = self.field_hint(fid, sentences=3)
            msg = f("field_explain", self.lang, label=field_label(fld, self.lang)) + (" " + hint if hint else "")
            insufficient = not hint
        if insufficient:
            self.questions.append(question)
            self.suggestions.append({"content": f("note_ask_office", self.lang, q=question), "item_type": "question"})
        back = reask or fid
        if back in self.by_id:
            msg += "\n\n" + f("reask", self.lang, label=self._label(back))
            self.state["current_field"] = back
        return msg

    # ---------------------------------------------------------------- persist
    def _finish(self, reply: str, user_text: str | None, scr: dict) -> dict:
        status, progress = compute_status(self.form, self.values, self.skipped)
        self.app.form_data = dict(self.values)
        self.app.field_status = status
        self.app.progress = progress
        cur = self.state.get("current_field")
        self.app.next_section = self.by_id[cur]["section_title"] if cur in self.by_id else None
        if self.app.status in ("DRAFT",):
            self.app.status = "IN_PROGRESS"
        ai_notes = build_ai_notes(self.db, self.app, self.form, self.lang, self.questions)
        self.app.updated_at = utcnow()
        if user_text:
            self.db.add(Message(conversation_id=self.conv.id, role="user", content=redact(user_text),
                                meta={"current_field": cur, "focused_field": scr.get("focused_field")}))
        masked_updates = {k: mask(self._field(k), v) for k, v in self.updates.items()}
        self.db.add(Message(conversation_id=self.conv.id, role="assistant", content=reply, evidence=self.evidence,
                            meta={"field_updates": masked_updates, "mode": self.mode,
                                  "screen": {k: v for k, v in scr.items() if k not in ("vision", "ocr")}}))
        self.conv.state = self.state
        self.conv.updated_at = utcnow()
        self.db.commit()
        cur_f = self._field(cur) if cur in self.by_id else None
        return {
            "session_id": self.conv.id, "reply": reply, "language": self.lang,
            "current_field": {"id": cur, "label": field_label(cur_f, self.lang), "section": cur_f["section_title"]} if cur_f else None,
            "field_updates": self.updates, "form_data": self.values, "field_status": status, "progress": progress,
            "ai_notes": ai_notes, "suggested_notes": self.suggestions, "evidence": self.evidence,
            "screen_understanding": scr, "action": self.action, "mode": self.mode, "pending_fill": self.pending,
        }
