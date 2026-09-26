"""KAG agent: question -> understanding -> graph + documents -> LLM -> validated citations.

The LLM is the interpreter, never the authority: it only sees retrieved graph
facts and evidence chunks, must cite their IDs, and the backend validates every
ID and resolves source metadata itself.
"""
from __future__ import annotations

import re

from sqlalchemy.orm import Session

from app.kag.prompts import SYSTEM_PROMPT, build_user_prompt
from app.kag.query_understanding import QueryContext, understand
from app.kag.retriever import Evidence, KAGResult, build_context, retrieve
from app.kag.templates import localized_name, t
from app.services.ai import get_ai

CITE_RE = re.compile(r"\[((?:chunk|fact)_[a-z0-9_]+)\]")


def _clean_citations(answer: str, allowed: set[str]) -> tuple[str, list[str]]:
    used: list[str] = []

    def repl(m: re.Match) -> str:
        cid = m.group(1)
        if cid in allowed:
            if cid not in used:
                used.append(cid)
            return m.group(0)
        return ""  # drop invented IDs

    cleaned = CITE_RE.sub(repl, answer)
    # also drop bracketed IDs with multiple ids like [chunk_a, chunk_b]
    def multi(m: re.Match) -> str:
        ids = [x.strip() for x in m.group(1).split(",")]
        keep = [i for i in ids if i in allowed]
        for i in keep:
            if i not in used:
                used.append(i)
        return "".join(f"[{i}]" for i in keep)

    cleaned = re.sub(r"\[((?:(?:chunk|fact)_[a-z0-9_]+\s*,\s*)+(?:chunk|fact)_[a-z0-9_]+)\]", multi, cleaned)
    return re.sub(r"[ \t]+([.,;])", r"\1", cleaned).strip(), used


def _sentences(text: str) -> list[str]:
    text = re.sub(r"^>.*$", "", text, flags=re.M)  # drop demo banner blockquotes
    return [s.strip() for s in re.split(r"(?<=[.!?।])\s+|\n+", text) if len(s.strip()) > 25]


STOP = set("the a an of to for and or in on is are be your you my i do does what how when where can with at by it this that".split())


TIME_Q = re.compile(r"how (many|long)|deadline|within|how soon|by when|कितने दिन|ಎಷ್ಟು ದಿನ", re.I)
TIME_A = re.compile(r"\d+\s*(hours?|days?|weeks?|months?)", re.I)


def _stems(text: str) -> set[str]:
    return {w[:5] for w in re.findall(r"\w+", text.lower()) if w not in STOP}


def _overlap(q: set[str], s: str, time_q: bool = False) -> int:
    return len(q & _stems(s)) + (2 if time_q and TIME_A.search(s) else 0)


def _best_sentences(chunk: Evidence, query: str, n: int = 2, min_overlap: int = 0) -> list[str]:
    time_q = bool(TIME_Q.search(query))
    q = _stems(query)
    sents = _sentences(chunk.text)
    _ov = _overlap
    _overlap_q = lambda qq, s_: _ov(qq, s_, time_q)  # noqa: E731
    scored = sorted(range(len(sents)), key=lambda i: (-_overlap_q(q, sents[i]), i))
    keep = sorted(i for i in scored[:n] if _overlap_q(q, sents[i]) >= min_overlap)
    return [sents[i] for i in keep]


def _scheme_chunk(result: KAGResult, code: str) -> Evidence | None:
    return result.anchors.get(code)


def _fid(code: str) -> str:
    return "fact_" + re.sub(r"[^a-z0-9]+", "_", code.lower())


def _chunk_steps(chunk: Evidence, limit: int = 6) -> list[str]:
    """Numbered/bulleted lines of a procedure chunk, without its heading."""
    lines = [ln.strip() for ln in chunk.text.splitlines() if ln.strip() and not ln.lstrip().startswith("#")]
    steps = [re.sub(r"^(\d+[.)]|[-*•])\s*", "", ln) for ln in lines if re.match(r"^(\d+[.)]|[-*•])\s", ln)]
    return (steps or [s_ for s_ in _sentences(chunk.text)])[:limit]


def _other_schemes_note(result: KAGResult, lang: str) -> list[str]:
    """When a follow-up could refer to several schemes, say which one was answered."""
    if not result.query.from_context or len(result.schemes) < 2:
        return []
    first, rest = result.schemes[0], result.schemes[1:]
    others = ", ".join((s.get("short_name") or localized_name(s, lang)) for s in rest)
    return ["", "_" + t("other_schemes", lang, scheme=first.get("short_name") or localized_name(first, lang), others=others) + "_"]


def insufficient_text(q: QueryContext) -> str:
    text = f"{t('insufficient', q.language)} {t('insufficient_hint', q.language)}"
    if not q.life_event and (q.from_context or not q.scheme_codes):
        # nothing in the question itself tied it to a scheme: remind the citizen what the assistant covers
        text += "\n\n" + t("out_of_scope_hint", q.language)
    return text


def compose_fallback(result: KAGResult, channel: str = "web") -> tuple[str, list[str]]:
    """Deterministic, citation-preserving answer used when no LLM is reachable."""
    q, lang = result.query, result.query.language
    idx = result.evidence_index
    compact = channel == "telegram"
    lines: list[str] = []
    if q.intent == "discover" and q.life_event and result.schemes:
        lines.append(t("life_event_intro", lang, event=localized_name(q.life_event, lang)))
        lines.append("")
        for s in result.schemes:
            fid = _fid(s["code"])
            lines.append(f"**{localized_name(s, lang)}** — {s.get('summary', '')} [{fid}]")
            if s.get("rules") and not compact:
                r = s["rules"][0]
                rid = "fact_" + r["code"].lower()
                lines.append(f"- {t('why_applies', lang)}: {r['text']} [{rid}]")
            if s.get("benefit"):
                ch = _scheme_chunk(result, s["code"])
                lines.append(f"- {t('benefit', lang)}: {s['benefit']}" + (f" [{ch.id}]" if ch else ""))
            if s.get("documents") and not compact:
                did = fid + "_docs"
                lines.append(f"- {t('documents', lang)}: " + ", ".join(localized_name(d, lang) for d in s["documents"]) + f" [{did}]")
            lines.append("")
        if lang != "en":
            lines.append(t("english_note", lang))
        lines.append(t("next_apply_chat" if compact else "next_apply", lang))
    elif q.intent == "amount" and result.schemes:
        s = result.schemes[0]
        lines.append(t("amount_intro", lang, scheme=localized_name(s, lang)))
        if s.get("benefit"):
            lines.append(f"- {s['benefit']} [{_fid(s['code'])}]")
        ch = _scheme_chunk(result, s["code"])
        if ch:
            quotes = _best_sentences(ch, q.retrieval_query + " amount benefit rupees per year", 2, min_overlap=1)
            if quotes:
                lines.append("")
                lines += [f"> {x} [{ch.id}]" for x in quotes]
        lines += _other_schemes_note(result, lang)
        if lang != "en":
            lines.append(t("english_note", lang))
    elif q.intent == "how_to_apply" and result.schemes:
        s = result.schemes[0]
        lines.append(t("apply_intro", lang, scheme=localized_name(s, lang)))
        ch = _scheme_chunk(result, s["code"])
        steps = _chunk_steps(ch) if ch else []
        lines += [f"{i}. {x}" for i, x in enumerate(steps, 1)]
        if ch and steps:
            lines.append(f"[{ch.id}]")
        portal = s.get("portal") or {}
        if portal.get("name"):
            lines.append("")
            lines.append(t("apply_portal", lang, portal=portal["name"] + (f" ({portal['url']})" if portal.get("url") else ""))
                         + f" [{_fid(s['code'])}]")
        lines += _other_schemes_note(result, lang)
        if lang != "en":
            lines.append(t("english_note", lang))
    elif q.intent == "documents" and result.schemes:
        s = result.schemes[0]
        fid = "fact_" + re.sub(r"[^a-z0-9]+", "_", s["code"].lower()) + "_docs"
        lines.append(t("docs_intro", lang, scheme=localized_name(s, lang)))
        for d in s.get("documents", []):
            lines.append(f"- {localized_name(d, lang)}")
        lines.append(f"[{fid}]")
        # quote the scheme's own documents section, never another scheme's list
        pool = [c for c in [result.anchors.get(s["code"]), *result.chunks]
                if c is not None and s["code"] in (c.meta.get("scheme_codes") or [])]
        ch = next((c for c in pool if "document" in (c.meta.get("section") or "").lower()), None)
        if ch:
            lines.append("")
            lines += [f"> {s_} [{ch.id}]" for s_ in _best_sentences(ch, q.retrieval_query, 2)]
        lines += _other_schemes_note(result, lang)
    elif q.intent == "eligibility" and result.schemes:
        s = result.schemes[0]
        lines.append(t("elig_intro", lang, scheme=localized_name(s, lang)))
        for r in s.get("rules", []):
            lines.append(f"- {r['text']} [fact_{r['code'].lower()}]")
        pool = [c for c in [result.anchors.get(s["code"]), *result.chunks] if c is not None and s["code"] in (c.meta.get("scheme_codes") or [])]
        quotes = [(c, x) for c in pool[:3] for x in _best_sentences(c, q.retrieval_query, 1, min_overlap=2)][:2]
        if quotes:
            lines.append("")
            lines += [f"> {x} [{c.id}]" for c, x in quotes]
        lines += _other_schemes_note(result, lang)
        if lang != "en":
            lines.append(t("english_note", lang))
    else:
        relevant = [c for c in result.chunks if c.meta.get("relevant")][:4]
        time_q = bool(TIME_Q.search(q.retrieval_query))
        qs = _stems(q.retrieval_query)
        cands = [(_overlap(qs, s_, time_q) + (0.5 if rank == 0 else 0), rank, c, s_)
                 for rank, c in enumerate(relevant) for s_ in _sentences(c.text)]
        cands = [x for x in cands if x[0] >= 2]
        cands.sort(key=lambda x: (-x[0], x[1]))
        picked = [(c, s_) for _, _, c, s_ in cands[:3]]
        if not picked and result.schemes and not q.from_context:
            # a question naming a scheme with no closer match: describe the scheme from the graph
            for s in result.schemes[:2]:
                lines.append(f"**{localized_name(s, lang)}** — {s.get('summary', '')} [{_fid(s['code'])}]")
                if s.get("benefit"):
                    lines.append(f"- {t('benefit', lang)}: {s['benefit']}")
                lines.append("")
        elif not picked:
            return insufficient_text(q), []
        else:
            lines.append(t("general_intro", lang))
        for c, s_ in picked:
            lines.append(f"- {s_} [{c.id}]")
        if lang != "en":
            lines.append(t("english_note", lang))
    lines.append("")
    lines.append(f"_{t('verify_note', lang)}_")
    text = "\n".join(lines)
    return _clean_citations(text, set(idx))


def resolve_evidence(result: KAGResult, ids: list[str]) -> list[dict]:
    idx = result.evidence_index
    return [idx[i].as_dict() for i in ids if i in idx]


def scheme_card(s: dict, lang: str) -> dict:
    return {
        "code": s["code"], "name": s["name"], "display_name": localized_name(s, lang), "short_name": s.get("short_name"),
        "summary": s.get("summary"), "benefit": s.get("benefit"), "form_id": s.get("form_id"),
        "department": (s.get("department") or {}).get("name"), "portal": s.get("portal"),
        "rules": s.get("rules", []),
        "documents": [{"code": d["code"], "name": d["name"], "display_name": localized_name(d, lang), "wallet_types": d.get("wallet_types", [])} for d in s.get("documents", [])],
        "fact_id": "fact_" + re.sub(r"[^a-z0-9]+", "_", s["code"].lower()),
    }


SMALLTALK_INTENTS = ("greeting", "thanks", "about")


def explain_previous(previous_evidence: list[dict], lang: str) -> tuple[str, list[dict]]:
    """Answer "why did you tell me this?" from the evidence stored with the previous reply."""
    ev = previous_evidence or []
    lines = [t("why_answer", lang) if ev else t("why_none", lang)]
    for i, e in enumerate(ev, 1):
        lines.append(f"{i}. **{e.get('publisher') or e.get('source_title')}** — {e.get('source_title')}"
                     + (f" · {e.get('section')}" if e.get("section") else "") + f" [{e['id']}]")
    return "\n".join(lines), ev


def _conversational(q: QueryContext, text: str, evidence: list[dict] | None = None) -> dict:
    ev = evidence or []
    return {"answer": text, "language": q.language, "citations": [e["id"] for e in ev], "evidence": ev, "retrieved": ev,
            "grounded": True, "insufficient_evidence": False, "mode": "rule", "understanding": q.as_dict(),
            "schemes": [], "retrieval": {}}


def answer(db: Session, question: str, language: str | None = None, *, context_schemes: list[str] | None = None,
           state: str | None = None, extra_context: str = "", history: str = "", extra_query: str = "",
           query: QueryContext | None = None, channel: str = "web", previous_evidence: list[dict] | None = None) -> dict:
    """``channel`` ("web" | "telegram") adapts length and formatting. ``previous_evidence`` (the evidence of
    the last assistant reply) enables answering "why did you tell me this?" without a new retrieval."""
    q = query or understand(question, language, context_schemes, state)
    if language and language in ("en", "hi", "kn"):
        q.language = language  # user's chosen UI/voice language wins for the response
    if q.intent in SMALLTALK_INTENTS:
        return _conversational(q, t(q.intent, q.language))
    if q.intent == "why" and previous_evidence is not None:
        text, ev = explain_previous(previous_evidence, q.language)
        return _conversational(q, text, ev)
    result = retrieve(db, q, extra_query=extra_query)
    allowed = set(result.evidence_index)
    mode = "llm"

    if not result.has_relevant_evidence():
        return _package(result, insufficient_text(q), [], grounded=True, insufficient=True, mode="rule")

    raw = get_ai().generate_json([
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": build_user_prompt(question, build_context(result), q.language, extra_context, history,
                                                      channel=channel, scheme_note=_scheme_note(q, result))},
    ])
    if raw and isinstance(raw.get("answer"), str) and raw["answer"].strip():
        text, used = _clean_citations(raw["answer"], allowed)
        for cid in raw.get("citations") or []:
            if isinstance(cid, str) and cid in allowed and cid not in used:
                used.append(cid)
        insufficient = bool(raw.get("insufficient_evidence"))
        grounded = bool(used) or insufficient
        if not grounded:
            text += "\n\n" + t("unverified", q.language)
    else:
        mode = "fallback"
        text, used = compose_fallback(result, channel)
        insufficient = not used
        grounded = True
    return _package(result, text, used, grounded=grounded, insufficient=insufficient, mode=mode)


def _scheme_note(q: QueryContext, result: KAGResult) -> str:
    if not result.schemes:
        return ""
    names = ", ".join(s["name"] for s in result.schemes)
    if q.from_context:
        return (f"The citizen is asking a follow-up about schemes from the earlier conversation: {names}. "
                "If the question clearly refers to one of them, answer for that one; otherwise answer briefly for each.")
    if q.life_event:
        return f"The citizen's situation matches the life event '{q.life_event['name']}'. Schemes linked in the graph: {names}."
    return f"Schemes relevant to this question: {names}."


def _package(result: KAGResult, text: str, used: list[str], *, grounded: bool, insufficient: bool, mode: str) -> dict:
    lang = result.query.language
    show_schemes = result.query.intent in ("discover", "general", "amount", "eligibility", "documents", "how_to_apply") and not insufficient
    return {
        "answer": text,
        "language": lang,
        "citations": used,
        "evidence": resolve_evidence(result, used),
        "retrieved": [e.as_dict() for e in [*result.facts, *result.chunks]],
        "grounded": grounded,
        "insufficient_evidence": insufficient,
        "mode": mode,
        "understanding": result.query.as_dict(),
        "schemes": [scheme_card(s, lang) for s in result.schemes] if show_schemes else [],
        "retrieval": result.debug,
    }
