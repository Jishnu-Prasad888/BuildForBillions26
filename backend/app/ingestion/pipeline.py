"""Admin upload / web source -> extract -> clean -> chunk -> embed -> store -> graph."""
from __future__ import annotations

import hashlib
import logging
import re
import uuid
from pathlib import Path
from urllib.parse import urlparse

import httpx
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.graph import get_graph
from app.ingestion.chunker import chunk_blocks
from app.ingestion.extract import ALLOWED_EXTENSIONS, extract, extract_html, extract_pdf
from app.kag.lang import detect_language
from app.models import IngestionJob, KnowledgeChunk, KnowledgeDocument, KnowledgeSource
from app.models.common import utcnow
from app.services.ai import get_ai

log = logging.getLogger(__name__)

STAGES = ["UPLOADED", "EXTRACTING", "CHUNKING", "EMBEDDING", "INDEXING", "COMPLETE"]


def sha256(data: bytes | str) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def new_chunk_id() -> str:
    return "chunk_" + uuid.uuid4().hex[:10]


def _stage(db: Session, job: IngestionJob, status: str, detail: str = "") -> None:
    job.status = status
    job.stages = [*job.stages, {"stage": status, "at": utcnow().isoformat(), "detail": detail}]
    db.commit()


def get_or_create_source(db: Session, name: str, publisher: str, base_url: str | None, is_demo: bool, category: str = "government") -> KnowledgeSource:
    q = select(KnowledgeSource).where(KnowledgeSource.name == name)
    src = db.scalars(q).first()
    if src:
        return src
    src = KnowledgeSource(name=name, publisher=publisher, base_url=base_url, is_demo=is_demo, category=category,
                          is_official=not is_demo or bool(base_url and (".gov.in" in base_url or ".nic.in" in base_url)))
    db.add(src)
    db.flush()
    return src


def detect_scheme_mentions(text: str) -> list[str]:
    """Simple entity extraction: find schemes from the graph mentioned in the text."""
    lower = text.lower()
    found = []
    for s in get_graph().list_schemes():
        aliases = {s["name"], s.get("short_name") or "", s["code"].replace("_", " ")}
        m = re.search(r"\(([^)]+)\)", s["name"])
        if m:
            aliases.add(m.group(1))
        aliases |= {"pm-kisan", "pm kisan"} if s["code"] == "PM_KISAN" else set()
        aliases |= {"pmfby", "fasal bima", "crop insurance"} if s["code"] == "PMFBY" else set()
        aliases |= {"kisan credit card", "kcc", "crop loan"} if s["code"] == "KCC_CALAMITY_RELIEF" else set()
        aliases |= {"input subsidy", "sdrf", "ndrf", "crop loss relief"} if s["code"] == "CROP_LOSS_RELIEF_KA" else set()
        if any(a and len(a) > 2 and re.search(r"\b" + re.escape(a.lower()) + r"\b", lower) for a in aliases):
            found.append(s["code"])
    return found


def create_document_record(db: Session, *, title: str, kind: str, publisher: str, source_name: str | None,
                           source_url: str | None, filename: str | None = None, file_path: str | None = None,
                           mime_type: str | None = None, language: str = "en", published_date: str | None = None,
                           is_demo: bool = False, scheme_codes: list[str] | None = None, uploaded_by: str | None = None,
                           doc_id: str | None = None) -> tuple[KnowledgeDocument, IngestionJob]:
    src = get_or_create_source(db, source_name or publisher or "Unknown source", publisher or "", source_url, is_demo)
    doc = KnowledgeDocument(
        id=doc_id or uuid.uuid4().hex, title=title, source_id=src.id, publisher=publisher, source_url=source_url,
        filename=filename, file_path=file_path, mime_type=mime_type, kind=kind, language=language,
        published_date=published_date, is_demo=is_demo, scheme_codes=scheme_codes or [], uploaded_by=uploaded_by,
        status="UPLOADED",
    )
    db.add(doc)
    db.flush()
    job = IngestionJob(document_id=doc.id, kind=kind, title=title, status="UPLOADED",
                       stages=[{"stage": "UPLOADED", "at": utcnow().isoformat(), "detail": filename or source_url or ""}])
    db.add(job)
    db.commit()
    return doc, job


def fetch_url(url: str) -> tuple[bytes, str]:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only http(s) URLs are supported")
    headers = {"User-Agent": "Mozilla/5.0 (compatible; PublicServiceAI-Hackathon/0.1; +knowledge-ingestion)"}
    with httpx.Client(follow_redirects=True, timeout=25, headers=headers) as client:
        r = client.get(url)
        r.raise_for_status()
        if len(r.content) > settings.MAX_UPLOAD_SIZE:
            raise ValueError("Remote document too large")
        return r.content, r.headers.get("content-type", "")


def run_job(job_id: str, raw: bytes | None = None, ext: str | None = None) -> None:
    """Executes the pipeline for one job. Safe to run in a FastAPI BackgroundTask."""
    db = SessionLocal()
    try:
        job = db.get(IngestionJob, job_id)
        doc = db.get(KnowledgeDocument, job.document_id)
        try:
            _run(db, job, doc, raw, ext)
        except Exception as exc:  # noqa: BLE001
            log.exception("Ingestion failed for %s", doc.title if doc else job_id)
            db.rollback()
            job = db.get(IngestionJob, job_id)
            doc = db.get(KnowledgeDocument, job.document_id)
            job.error = str(exc)[:2000]
            job.finished_at = utcnow()
            if doc:
                doc.status = "FAILED"
            _stage(db, job, "FAILED", str(exc)[:300])
    finally:
        db.close()


def _run(db: Session, job: IngestionJob, doc: KnowledgeDocument, raw: bytes | None, ext: str | None) -> None:
    # ---- EXTRACTING ------------------------------------------------------
    _stage(db, job, "EXTRACTING", "Reading document text")
    doc.status = "EXTRACTING"
    meta: dict = {}
    if doc.kind == "web":
        raw, ctype = fetch_url(doc.source_url)
        doc.retrieved_at = utcnow()
        if "pdf" in ctype or doc.source_url.lower().endswith(".pdf"):
            blocks = extract_pdf(raw)
        else:
            title, blocks = extract_html(raw.decode("utf-8", errors="replace"))
            if title and (not doc.title or doc.title == doc.source_url):
                doc.title = title[:500]
                job.title = doc.title
    else:
        if raw is None and doc.file_path:
            raw = Path(doc.file_path).read_bytes()
            ext = Path(doc.file_path).suffix
        meta, blocks = extract(raw, ext or ".txt")
        if meta.get("title") and doc.kind != "seed" and doc.title == doc.filename:
            doc.title = meta["title"]
    if doc.kind == "upload" and doc.title == doc.filename and blocks and blocks[0].get("section"):
        doc.title = blocks[0]["section"][:500]
        job.title = doc.title
    full_text = "\n\n".join(b["text"] for b in blocks)
    if len(full_text.strip()) < 20:
        raise ValueError("No extractable text found (scanned PDFs need OCR, which is not included in the prototype)")
    doc.content_hash = sha256(full_text)
    doc.language = detect_language(full_text[:3000], doc.language or "en")
    db.commit()

    # ---- CHUNKING --------------------------------------------------------
    _stage(db, job, "CHUNKING", f"{len(full_text):,} characters extracted from {len(blocks)} blocks")
    doc.status = "CHUNKING"
    chunks = chunk_blocks(blocks)

    # ---- ENTITY EXTRACTION (for graph + chunk tagging) ---------------------
    # Explicit links (front matter / admin selection) win; otherwise fall back to detected mentions.
    mentioned = detect_scheme_mentions(full_text)
    scheme_codes = sorted(set(doc.scheme_codes or []) or set(mentioned))
    doc.scheme_codes = scheme_codes

    # ---- EMBEDDING -------------------------------------------------------
    _stage(db, job, "EMBEDDING", f"{len(chunks)} chunks → embeddings")
    doc.status = "EMBEDDING"
    db.commit()
    vectors, model_id = get_ai().embed([c["embed_text"] for c in chunks], kind="document")

    # ---- INDEXING --------------------------------------------------------
    _stage(db, job, "INDEXING", f"Embedding model: {model_id}")
    doc.status = "INDEXING"
    db.execute(delete(KnowledgeChunk).where(KnowledgeChunk.document_id == doc.id))
    for i, (c, vec) in enumerate(zip(chunks, vectors)):
        chunk_schemes = sorted(set(scheme_codes if len(scheme_codes) == 1 else []) | set(detect_scheme_mentions(c["text"])))
        db.add(KnowledgeChunk(
            id=new_chunk_id(), document_id=doc.id, chunk_index=i, content=c["text"], section=c.get("section"),
            page=c.get("page"), language=doc.language, scheme_codes=chunk_schemes or scheme_codes,
            content_hash=sha256(c["text"]), embedding=vec, embedding_model=model_id,
        ))
    doc.chunk_count = len(chunks)
    src = db.get(KnowledgeSource, doc.source_id) if doc.source_id else None
    get_graph().upsert_document(doc.id, doc.title, src.name if src else doc.publisher, doc.publisher, scheme_codes)

    doc.status = "COMPLETE"
    job.finished_at = utcnow()
    job.detail = {"chunks": len(chunks), "embedding_model": model_id, "schemes_linked": scheme_codes,
                  "characters": len(full_text), "language": doc.language}
    _stage(db, job, "COMPLETE", f"{len(chunks)} chunks indexed; linked to {', '.join(scheme_codes) or 'no scheme'}")


def reembed_all(db: Session) -> dict:
    """Re-embed every chunk with the current embedding provider (use after switching models)."""
    chunks = db.scalars(select(KnowledgeChunk)).all()
    texts = [f"{c.section}\n{c.content}" if c.section else c.content for c in chunks]
    vectors, model_id = get_ai().embed(texts, kind="document") if texts else ([], get_ai().embedding_model_id)
    for c, v in zip(chunks, vectors):
        c.embedding = v
        c.embedding_model = model_id
    db.commit()
    return {"chunks": len(chunks), "embedding_model": model_id}


def save_upload(data: bytes, filename: str) -> Path:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type {ext}. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")
    folder = settings.upload_path / "knowledge"
    folder.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", Path(filename).name)[-120:]
    path = folder / f"{uuid.uuid4().hex[:8]}_{safe}"
    path.write_bytes(data)
    return path
