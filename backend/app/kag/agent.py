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


def compose_fallback(result: KAGResult) -> tuple[str, list[str]]:
    """Deterministic, citation-preserving answer used when no LLM is reachable."""
    q, lang = result.query, result.query.language
    idx = result.evidence_index
    lines: list[str] = []
    if q.intent == "discover" and q.life_event and result.schemes:
        lines.append(t("life_event_intro", lang, event=localized_name(q.life_event, lang)))
        lines.append("")
        for s in result.schemes:
            fid = "fact_" + re.sub(r"[^a-z0-9]+", "_", s["code"].lower())
            lines.append(f"**{localized_name(s, lang)}** — {s.get('summary', '')} [{fid}]")
            if s.get("rules"):
                r = s["rules"][0]
                rid = "fact_" + r["code"].lower()
                lines.append(f"- {t('why_applies', lang)}: {r['text']} [{rid}]")
            if s.get("benefit"):
                ch = _scheme_chunk(result, s["code"])
                lines.append(f"- {t('benefit', lang)}: {s['benefit']}" + (f" [{ch.id}]" if ch else ""))
            if s.get("documents"):
                did = fid + "_docs"
                lines.append(f"- {t('documents', lang)}: " + ", ".join(localized_name(d, lang) for d in s["documents"]) + f" [{did}]")
            lines.append("")
        if lang != "en":
            lines.append(t("english_note", lang))
        lines.append(t("next_apply", lang))
    elif q.intent == "documents" and result.schemes:
        s = result.schemes[0]
        fid = "fact_" + re.sub(r"[^a-z0-9]+", "_", s["code"].lower()) + "_docs"
        lines.append(t("docs_intro", lang, scheme=localized_name(s, lang)))
        for d in s.get("documents", []):
            lines.append(f"- {localized_name(d, lang)}")
        lines.append(f"[{fid}]")
        ch = next((c for c in result.chunks if "document" in (c.meta.get("section") or "").lower() and c.meta.get("relevant")), None)
        if ch:
            lines.append("")
            lines += [f"> {s_} [{ch.id}]" for s_ in _best_sentences(ch, q.retrieval_query, 2)]
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
        if not picked:
            return f"{t('insufficient', lang)} {t('insufficient_hint', lang)}", []
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


def answer(db: Session, question: str, language: str | None = None, *, context_schemes: list[str] | None = None,
           state: str | None = None, extra_context: str = "", history: str = "", extra_query: str = "",
           query: QueryContext | None = None) -> dict:
    q = query or understand(question, language, context_schemes, state)
    if language and language in ("en", "hi", "kn"):
        q.language = language  # user's chosen UI/voice language wins for the response
    result = retrieve(db, q, extra_query=extra_query)
    allowed = set(result.evidence_index)
    mode = "llm"

    if not result.has_relevant_evidence():
        text = f"{t('insufficient', q.language)} {t('insufficient_hint', q.language)}"
        return _package(result, text, [], grounded=True, insufficient=True, mode="rule")

    raw = get_ai().generate_json([
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": build_user_prompt(question, build_context(result), q.language, extra_context, history)},
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
        text, used = compose_fallback(result)
        insufficient = not used
        grounded = True
    return _package(result, text, used, grounded=grounded, insufficient=insufficient, mode=mode)


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
