"""Document knowledge: what does *this form* mean?

Three systems answer three different questions, and this module owns only the first two:

    document understanding -> structure.py     "what is physically on the page"
    form schema            -> fields.py        "what are the real fields and their properties"
    document knowledge     -> knowledge.py     "what does this form/field mean?"
    RAG                    -> app/kag          "what do official sources say?"  (called by the assistant)

Nothing in here writes to form state: asking "What does PAN mean?" can never change the PAN field. Retrieval
is scoped to this form (its own text and structure first) and only then falls back to the knowledge base.
"""
from __future__ import annotations

import re

from app.services.formdoc import fields as fields_mod
from app.services.formdoc.questions import GLOSSARY, glossary_for

#: Words that mean "explain this thing" rather than "give me an answer".
ASK_ABOUT = re.compile(r"\b(what|meaning|means|kya\s+matlab|kya\s+hai|explain|matlab|kya)\b", re.I)


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def _has_word(haystack: str, needle: str) -> bool:
    return bool(re.search(rf"(?<![a-z0-9]){re.escape(needle)}(?![a-z0-9])", haystack))


def term_in_question(question: str) -> str | None:
    """A glossary term the citizen asked about, longest first ("permanent account number" before "pan")."""
    low = f" {_norm(question)} "
    for term in sorted(GLOSSARY, key=len, reverse=True):
        if re.search(rf"(?<![a-z]){re.escape(_norm(term))}(?![a-z])", low):
            return term
    return None


def find_field(question: str, fields: list[dict], prefer: str | None = None) -> dict | None:
    """Which field is the citizen talking about? Structured lookup first, then label-word matching."""
    if prefer:
        hit = next((f for f in fields if f["field_id"] == prefer), None)
        if hit:
            return hit
    low = _norm(question)
    best, best_score = None, 0
    for f in fields:
        label = _norm(f.get("label", ""))
        if not label:
            continue
        score = 0
        # Whole words only: a two-letter label such as "To" must not match "photograph" or "how to".
        if len(label) >= 4 and _has_word(low, label):
            score = len(label.split()) + 3
        else:
            words = [w for w in label.split() if len(w) > 3]
            hits = sum(1 for w in words if _has_word(low, w))
            if hits == len(words) and hits:
                score = hits
        ident = _norm(f.get("normalized_label", "")).replace(" ", "_")
        if ident and re.search(rf"(?<![a-z]){re.escape(ident)}(?![a-z])", low):
            score += 2
        if score > best_score:
            best, best_score = f, score
    return best if best_score >= 2 else None


def _structure_lines(structure: list[dict] | None) -> list[str]:
    """Every printed line of the document, as knowledge text (instructions, help text, headings)."""
    out: list[str] = []
    for page in structure or []:
        for el in page.get("elements", []):
            if el.get("type") in ("instruction", "example", "help_text") and el.get("text"):
                out.append(el["text"])
    return out


class DocumentKnowledge:
    """Answers questions about one uploaded form, in a fixed order of trust.

    1. the form's own structure (what it says about this field),
    2. the form's own printed instructions near the field,
    3. a glossary explanation of any term in the label,
    4. the caller may then ask the knowledge base (KAG) for official information.
    """

    def __init__(self, form, fields: list[dict], structure: list[dict] | None = None):
        self.form = form
        self.fields = fields
        self.structure = structure or []
        self.lines = _structure_lines(self.structure)

    # ---------------------------------------------------------------- structure
    def field_notes(self, field: dict) -> list[str]:
        bits: list[str] = []
        if field.get("section"):
            bits.append(f"It is in the “{field['section']}” section, on page {field.get('page', 1)}.")
        if field.get("description"):
            bits.append(f"The form prints this next to it: “{field['description']}”.")
        if field.get("options"):
            bits.append("The options on the form are: " + ", ".join(field["options"][:8]) + ".")
        if field.get("required"):
            bits.append("The form asks for it.")
        else:
            bits.append("The form treats it as optional.")
        if field.get("conditional"):
            bits.append("It only applies in some cases.")
        return bits

    def nearby_instructions(self, field: dict, limit: int = 3) -> list[str]:
        """Instructions printed on the same page as the field, most relevant first."""
        page = next((p for p in self.structure if p.get("page") == field.get("page")), None)
        if not page:
            return []
        out: list[str] = []
        for el in page.get("elements", []):
            if el.get("type") != "instruction":
                continue
            label = _norm(field.get("label", ""))
            text = el.get("text", "")
            if label and (label in _norm(text) or _norm(text) in label):
                out.insert(0, text)
            else:
                out.append(text)
        return out[:limit]

    def title(self) -> str:
        for page in self.structure:
            if page.get("title"):
                return page["title"]
        return ""

    def sections(self) -> list[str]:
        seen: list[str] = []
        for page in self.structure:
            for s in page.get("sections", []) or []:
                name = s.get("name")
                if name and name not in seen:
                    seen.append(name)
        return seen

    # ---------------------------------------------------------------- answering
    def answer(self, question: str, field: dict | None = None) -> dict:
        """A grounded answer from the document itself. Never touches field values.

        Returns ``{"answer", "source", "field_id", "label"}``; ``answer`` is "" when the document says
        nothing about the question, so the caller can fall back to the knowledge base.
        """
        target = field or find_field(question, self.fields)
        parts: list[str] = []
        source = ""

        if target:
            from app.services.formdoc.questions import explain_field

            parts.append(explain_field(target))
            notes = self.field_notes(target)
            if notes:
                parts.append(" ".join(notes))
            nearby = self.nearby_instructions(target)
            if nearby:
                parts.append("The form also says: “" + "” “".join(nearby) + "”")
            source = "form"

        term = term_in_question(question) or (term_in_question(f"{target.get('label', '')} {target.get('description', '')}")
                                              if target else None)
        if term:
            explanation, _ = glossary_for(term)
            if explanation:
                parts.append(f"Here {term.upper() if len(term) <= 4 else term} means {explanation}.")
                source = source or "glossary"

        if not target and not term:
            # Nothing structured matched: fall back to the form's printed instructions, quoted as such.
            hits = [ln for ln in self.lines if _norm(question) and any(w in _norm(ln) for w in _norm(question).split() if len(w) > 4)]
            if hits:
                parts.append("This form says: “" + hits[0] + "”")
                source = "form"

        return {"answer": " ".join(p for p in parts if p), "source": source,
                "field_id": (target or {}).get("field_id"), "label": (target or {}).get("label")}

    def describe_document(self) -> dict:
        """Title, sections and field count, for the opening summary."""
        return {"title": self.title(), "sections": self.sections(), "field_count": len(self.fields),
                "normalized_ids": sorted({f.get("normalized_label", "") for f in self.fields if f.get("normalized_label")})}


def summarize_labels(fields: list[dict], limit: int = 60) -> str:
    """One line of "label (type)" pairs, used to give the model context. Values are never included."""
    return "; ".join(f"{f.get('label', '')} ({f.get('type', '')})" for f in fields[:limit])


def stable_ids(fields: list[dict]) -> dict[str, str]:
    """normalized_label -> label, for retrieval metadata."""
    return {f["normalized_label"]: f["label"] for f in fields if f.get("normalized_label")}


def field_metadata(field: dict, document_id: str) -> dict:
    """Metadata for one indexed document element (§13): document, page, section, field, label."""
    return {"document_id": document_id, "page": field.get("page"), "section": field.get("section"),
            "element_type": "field", "field_id": field.get("field_id"),
            "normalized_label": field.get("normalized_label"), "label": field.get("label"),
            "type": field.get("type"), "required": bool(field.get("required"))}
