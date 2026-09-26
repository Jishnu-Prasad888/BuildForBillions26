"""Steps 3-9 of KAG: graph retrieval, vector + keyword retrieval, merge, rank, context."""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.config import settings
from app.graph import get_graph
from app.kag.query_understanding import QueryContext
from app.models import KnowledgeChunk, KnowledgeDocument, KnowledgeSource
from app.services.ai import get_ai

STOPWORDS = set("""a an the is are was were be been i me my we our you your it its of in on at to for from with and or
not no do does did can could what which who how when where why this that these there here get got have has had will
would should shall may might about into over under by as if so than then them they he she his her help please tell
want need know""".split())

RRF_K = 5  # small k: strong agreement at the top of both rankings dominates boosts
MAX_PER_DOC = 3


@dataclass
class Evidence:
    id: str
    type: str  # chunk | graph_fact
    text: str
    score: float = 0.0
    retrieval: list[str] = field(default_factory=list)
    vector_similarity: float | None = None
    meta: dict = field(default_factory=dict)

    def as_dict(self) -> dict:
        return {"id": self.id, "type": self.type, "text": self.text, "score": round(self.score, 4),
                "retrieval": self.retrieval, "vector_similarity": None if self.vector_similarity is None else round(self.vector_similarity, 4),
                **self.meta}


@dataclass
class KAGResult:
    query: QueryContext
    schemes: list[dict]
    facts: list[Evidence]
    chunks: list[Evidence]
    debug: dict
    anchors: dict[str, Evidence] = field(default_factory=dict)  # scheme_code -> chunk from its linked source document

    @property
    def evidence_index(self) -> dict[str, Evidence]:
        return {e.id: e for e in [*self.facts, *self.chunks, *self.anchors.values()]}

    def has_relevant_evidence(self) -> bool:
        return bool(self.facts) or any(c.meta.get("relevant") for c in self.chunks)


# ---------------------------------------------------------------------------
# Graph retrieval
# ---------------------------------------------------------------------------
def graph_retrieve(q: QueryContext) -> list[dict]:
    g = get_graph()
    schemes: dict[str, dict] = {}
    if q.life_event:
        for s in g.schemes_for_life_event(q.life_event["code"], q.state):
            schemes[s["code"]] = s
    for code in q.scheme_codes:
        s = g.get_scheme(code)
        if s:
            schemes[code] = s
    return list(schemes.values())


def _fact_id(code: str) -> str:
    return "fact_" + re.sub(r"[^a-z0-9]+", "_", code.lower()).strip("_")


def graph_facts(schemes: list[dict], doc_titles: dict[str, str], focus: str = "general") -> list[Evidence]:
    facts: list[Evidence] = []
    for s in schemes:
        dept = (s.get("department") or {}).get("name", "")
        portal = s.get("portal") or {}
        base = {"scheme_code": s["code"], "scheme_name": s["name"], "source_title": "Knowledge Graph (Neo4j)",
                "publisher": dept, "url": portal.get("url"), "is_demo": True}
        sd = s.get("source_docs") or []
        supported = {"supporting_document": doc_titles.get(sd[0], sd[0]) if sd else None, "supporting_document_id": sd[0] if sd else None}
        facts.append(Evidence(
            id=_fact_id(s["code"]), type="graph_fact", retrieval=["graph"],
            text=f"Scheme: {s['name']}. {s.get('summary', '')} Benefit: {s.get('benefit', '')} "
                 f"Managed by: {dept}. Apply at: {portal.get('name', 'n/a')}.",
            meta={**base, **supported, "section": "Scheme", "relation": "(:LifeEvent)-[:MATCHES]->(:Scheme)-[:MANAGED_BY]->(:Department)"}))
        for r in s.get("rules", []):
            facts.append(Evidence(
                id=_fact_id(r["code"]), type="graph_fact", retrieval=["graph"], text=f"Eligibility rule for {s['name']}: {r['text']}",
                meta={**base, "section": "Eligibility rule", "rule_code": r["code"], "relation": "(:Scheme)-[:HAS_RULE]->(:EligibilityRule)-[:SUPPORTED_BY]->(:Document)",
                      "supporting_document": doc_titles.get(r.get("supported_by"), r.get("supported_by")), "supporting_document_id": r.get("supported_by")}))
        if s.get("documents"):
            facts.append(Evidence(
                id=_fact_id(s["code"] + "_docs"), type="graph_fact", retrieval=["graph"],
                text=f"Required documents for {s['name']}: " + "; ".join(d["name"] for d in s["documents"]) + ".",
                meta={**base, **supported, "section": "Required documents", "relation": "(:Scheme)-[:REQUIRES]->(:DocumentRequirement)",
                      "requirements": [d["code"] for d in s["documents"]]}))
    return facts


# ---------------------------------------------------------------------------
# Document retrieval
# ---------------------------------------------------------------------------
def _tokens(q: str) -> list[str]:
    toks = [t for t in re.findall(r"[\w\-]+", q.lower()) if t not in STOPWORDS and len(t) > 1]
    seen, out = set(), []
    for t in toks:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out[:24]


def vector_search(db: Session, query: str, limit: int = 20) -> list[tuple[str, float]]:
    [vec], model_id = get_ai().embed([query], kind="query")
    if settings.VECTOR_BACKEND == "pgvector":
        dist = KnowledgeChunk.embedding.cosine_distance(vec)
        rows = db.execute(
            select(KnowledgeChunk.id, dist.label("d")).where(KnowledgeChunk.embedding_model == model_id)
            .where(KnowledgeChunk.embedding.is_not(None)).order_by(dist).limit(limit)
        ).all()
        return [(r.id, 1.0 - float(r.d)) for r in rows]
    rows = db.execute(select(KnowledgeChunk.id, KnowledgeChunk.embedding).where(KnowledgeChunk.embedding_model == model_id)).all()

    def cos(a, b):
        na = math.sqrt(sum(x * x for x in a)) or 1
        nb = math.sqrt(sum(x * x for x in b)) or 1
        return sum(x * y for x, y in zip(a, b)) / (na * nb)

    scored = sorted(((r.id, cos(vec, r.embedding)) for r in rows if r.embedding), key=lambda x: -x[1])
    return scored[:limit]


def keyword_search(db: Session, query: str, limit: int = 20) -> list[tuple[str, float]]:
    """Full-text candidates (PostgreSQL tsvector, 'simple' config for multilingual text),
    re-scored with IDF so rare, specific words ("hailstorm", "IFSC") outweigh common ones ("crop")."""
    toks = [re.sub(r"[^\w]", "", t) for t in _tokens(query)]
    toks = [t for t in toks if t]
    if not toks:
        return []
    vec_sql = "to_tsvector('simple', coalesce(section,'') || ' ' || content)"
    rows = db.execute(text(
        f"SELECT id, {vec_sql}::text AS tsv FROM knowledge_chunks WHERE {vec_sql} @@ to_tsquery('simple', :q) LIMIT 300"),
        {"q": " | ".join(toks)}).all()
    if not rows:
        return []
    counts = ", ".join(f"count(*) FILTER (WHERE {vec_sql} @@ to_tsquery('simple', :t{i}))" for i in range(len(toks)))
    row = db.execute(text(f"SELECT count(*), {counts} FROM knowledge_chunks"), {f"t{i}": t for i, t in enumerate(toks)}).one()
    total = row[0] or 1
    df = {t: row[i + 1] or 0 for i, t in enumerate(toks)}
    idf = {t: math.log(1 + total / (1 + df[t])) for t in toks}
    scored = []
    for r in rows:
        lexemes = set(re.findall(r"'([^']+)'", r.tsv))
        sc = sum(idf[t] for t in toks if t in lexemes)
        if sc > 0:
            scored.append((r.id, sc))
    scored.sort(key=lambda x: -x[1])
    return scored[:limit]


INTENT_SECTIONS = {
    "eligibility": ("eligib", "exclusion", "condition"),
    "documents": ("document", "required"),
    "how_to_apply": ("apply", "registration", "intimate", "what the farmer should do", "how to"),
    "amount": ("amount", "benefit", "premium", "overview"),
}


def retrieve(db: Session, q: QueryContext, top_k: int = 8, extra_query: str = "") -> KAGResult:
    schemes = graph_retrieve(q)
    rq = (q.retrieval_query + " " + extra_query).strip()
    vec = vector_search(db, rq)
    kw = keyword_search(db, rq)

    fused: dict[str, float] = {}
    methods: dict[str, list[str]] = {}
    sims = dict(vec)
    for rank, (cid, _) in enumerate(vec):
        fused[cid] = fused.get(cid, 0) + 1 / (RRF_K + rank)
        methods.setdefault(cid, []).append("vector")
    for rank, (cid, _) in enumerate(kw):
        fused[cid] = fused.get(cid, 0) + 1 / (RRF_K + rank)
        methods.setdefault(cid, []).append("keyword")

    ids = list(fused)
    rows = db.execute(
        select(KnowledgeChunk, KnowledgeDocument, KnowledgeSource)
        .join(KnowledgeDocument, KnowledgeChunk.document_id == KnowledgeDocument.id)
        .outerjoin(KnowledgeSource, KnowledgeDocument.source_id == KnowledgeSource.id)
        .where(KnowledgeChunk.id.in_(ids))
    ).all() if ids else []

    graph_codes = {s["code"] for s in schemes}
    is_fallback = not get_ai().embeddings_available()
    sim_threshold = 0.55
    cand: list[Evidence] = []
    for chunk, doc, src in rows:
        score = fused[chunk.id]
        # Graph-guided boost: chunks describing schemes found in the graph
        if graph_codes and set(chunk.scheme_codes or []) & graph_codes:
            score *= 1.08
            methods[chunk.id].append("graph-linked")
        # Intent-aware boost on section headings
        sec = (chunk.section or "").lower()
        if any(k in sec for k in INTENT_SECTIONS.get(q.intent, ())):
            score *= 1.05
        sim = sims.get(chunk.id)
        # With the lexical fallback embedder, vector similarity alone is not trusted as relevance.
        relevant = "keyword" in methods[chunk.id] or (not is_fallback and sim is not None and sim >= sim_threshold)
        cand.append(_chunk_evidence(chunk, doc, src, score, methods[chunk.id], sim, relevant))
    cand.sort(key=lambda e: -e.score)
    per_doc: dict[str, int] = {}
    chunks: list[Evidence] = []
    for e in cand:
        d = e.meta["document_id"]
        if per_doc.get(d, 0) >= MAX_PER_DOC:
            continue
        per_doc[d] = per_doc.get(d, 0) + 1
        chunks.append(e)
        if len(chunks) >= top_k:
            break

    # Evidence -> graph expansion: if the graph query found nothing, use schemes of top evidence
    if not schemes:
        codes = []
        for e in chunks[:3]:
            if e.meta.get("relevant"):
                codes += [c for c in e.meta.get("scheme_codes") or [] if c not in codes]
        g = get_graph()
        schemes = [s for s in (g.get_scheme(c) for c in codes[:2]) if s]

    doc_titles = dict(db.execute(select(KnowledgeDocument.id, KnowledgeDocument.title)).all())
    facts = graph_facts(schemes, doc_titles, q.intent)
    anchors = graph_anchor_chunks(db, schemes, q.intent, {c.id for c in chunks})
    return KAGResult(query=q, schemes=schemes, facts=facts, chunks=chunks, anchors=anchors,
                     debug={"vector_hits": len(vec), "keyword_hits": len(kw), "graph_schemes": [s["code"] for s in schemes],
                            "embedding_model": get_ai().embedding_model_id if not is_fallback else "hash-fallback"})


def _chunk_evidence(chunk, doc, src, score: float, methods: list[str], sim: float | None, relevant: bool) -> Evidence:
    return Evidence(
        id=chunk.id, type="chunk", text=chunk.content, score=score, retrieval=methods, vector_similarity=sim,
        meta={
            "chunk_id": chunk.id, "document_id": doc.id, "chunk_index": chunk.chunk_index,
            "source_title": doc.title, "publisher": doc.publisher or (src.publisher if src else ""),
            "source_name": src.name if src else None, "url": doc.source_url, "section": chunk.section,
            "page": chunk.page, "language": chunk.language, "published_date": doc.published_date,
            "retrieved_at": (doc.retrieved_at or doc.created_at).isoformat() if (doc.retrieved_at or doc.created_at) else None,
            "content_hash": chunk.content_hash, "is_demo": doc.is_demo, "scheme_codes": chunk.scheme_codes,
            "relevant": relevant, "is_official_source": bool(src.is_official) if src else False,
        })


ANCHOR_SECTIONS = {
    "documents": ("document",), "eligibility": ("eligib",), "how_to_apply": ("apply", "intimate", "should do", "registration"),
    "amount": ("amount", "benefit", "premium", "claim settlement"),
}


def graph_anchor_chunks(db: Session, schemes: list[dict], intent: str, exclude: set[str]) -> dict[str, Evidence]:
    """Graph -> Document -> Chunk: for each scheme found in the graph, fetch the best chunk of the
    source document linked to it (DESCRIBED_IN), so every scheme fact is backed by document text."""
    out: dict[str, Evidence] = {}
    prefs = ANCHOR_SECTIONS.get(intent, ()) + ("overview", "benefit", "assistance amount", "kisan credit card")
    for s in schemes:
        doc_ids = s.get("source_docs") or []
        if not doc_ids:
            continue
        rows = db.execute(
            select(KnowledgeChunk, KnowledgeDocument, KnowledgeSource)
            .join(KnowledgeDocument, KnowledgeChunk.document_id == KnowledgeDocument.id)
            .outerjoin(KnowledgeSource, KnowledgeDocument.source_id == KnowledgeSource.id)
            .where(KnowledgeChunk.document_id.in_(doc_ids)).order_by(KnowledgeChunk.chunk_index)
        ).all()
        if not rows:
            continue

        def rank(row):
            sec = (row[0].section or "").lower()
            for i, p in enumerate(prefs):
                if p in sec:
                    return i
            return len(prefs) + row[0].chunk_index

        chunk, doc, src = min(rows, key=rank)
        out[s["code"]] = _chunk_evidence(chunk, doc, src, 0.0, ["graph-anchor"], None, True)
    return out


def build_context(result: KAGResult, max_chunk_chars: int = 1100) -> str:
    lines = ["GRAPH FACTS (from the Neo4j knowledge graph):"]
    if not result.facts:
        lines.append("(none)")
    for f in result.facts:
        sup = f" (supported by: {f.meta.get('supporting_document')})" if f.meta.get("supporting_document") else ""
        lines.append(f"[{f.id}] {f.text}{sup}")
    lines.append("")
    lines.append("RETRIEVED DOCUMENT EVIDENCE:")
    extra = [a for a in result.anchors.values() if a.id not in {c.id for c in result.chunks}]
    if not result.chunks and not extra:
        lines.append("(none)")
    for c in [*result.chunks, *extra]:
        m = c.meta
        lines.append(
            f"[{c.id}] Publisher: {m.get('publisher')} | Document: {m.get('source_title')} | Section: {m.get('section') or '-'}"
            f"{' | Page ' + str(m['page']) if m.get('page') else ''}{' | DEMO SEED SUMMARY' if m.get('is_demo') else ''}"
        )
        lines.append(c.text[:max_chunk_chars])
        lines.append("")
    return "\n".join(lines)
