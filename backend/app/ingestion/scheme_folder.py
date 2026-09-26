"""Sync the scraped scheme library (SCHEME_DIR) into the knowledge base.

Layout: one sub-folder per page, each with `meta.json` (title, source URL, kind, fetched_at) and
`content.txt` (text already extracted from the HTML/PDF/TXT source). Every folder becomes one
KnowledgeDocument (kind="folder") that goes through the normal pipeline: chunk -> embed -> Chroma.

The sync is idempotent: documents whose extracted text is unchanged are skipped, changed ones are
re-indexed, and documents whose folder was removed are deleted from the index.

Run from the admin Knowledge Base tab, automatically at startup, or by hand:
    python -m app.ingestion.scheme_folder [--force]
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
import threading
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from sqlalchemy import select, text

from app.config import settings
from app.database import SessionLocal, engine
from app.ingestion.extract import extract
from app.ingestion.pipeline import create_document_record, remove_document, run_job, sha256
from app.models import IngestionJob, KnowledgeDocument
from app.models.common import utcnow

log = logging.getLogger(__name__)

KIND = "folder"
MIN_CHARS = 200  # pages with less text than this (bare portal shells) add nothing useful
SYNC_LOCK_ID = 727_002  # Postgres advisory lock so only one replica syncs at a time

_run_lock = threading.Lock()
_status: dict = {"running": False, "total": 0, "done": 0, "current": None, "indexed": 0, "unchanged": 0,
                 "skipped": 0, "failed": 0, "removed": 0, "started_at": None, "finished_at": None, "error": None}


def doc_id_for(slug: str) -> str:
    return "sf-" + hashlib.sha256(slug.encode("utf-8")).hexdigest()[:24]


def _clean_title(title: str | None, slug: str) -> str:
    t = re.sub(r"\s*::\s*", " – ", title or "").strip(" -–|:")
    return (t or slug.replace("-", " ").title())[:500]


def _publisher(meta: dict) -> tuple[str, str | None]:
    """(publisher, public source URL). Local files have no URL."""
    url = meta.get("final_url") or meta.get("source_url") or ""
    if url.startswith(("http://", "https://")):
        host = urlparse(url).netloc.lower().removeprefix("www.")
        return host, url
    return "Scheme library", None


def scan() -> list[dict]:
    root = settings.scheme_path
    if not root.is_dir():
        return []
    out = []
    for d in sorted(p for p in root.iterdir() if p.is_dir()):
        meta_path, text_path = d / "meta.json", d / "content.txt"
        if not (meta_path.is_file() and text_path.is_file()):
            continue
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            log.warning("Unreadable meta.json in %s", d)
            continue
        if meta.get("status", "ok") != "ok":
            continue
        out.append({"slug": meta.get("slug") or d.name, "dir": d, "meta": meta, "text_path": text_path})
    return out


def status() -> dict:
    return dict(_status)


def start_background(force: bool = False) -> bool:
    """Start a sync in a daemon thread. Returns False if one is already running."""
    if _status["running"]:
        return False
    threading.Thread(target=sync, kwargs={"force": force}, name="scheme-folder-sync", daemon=True).start()
    return True


def sync(force: bool = False) -> dict:
    if not _run_lock.acquire(blocking=False):
        return status()
    try:
        if engine.dialect.name != "postgresql":  # tests / single-process SQLite: the thread lock is enough
            _sync(force)
            return status()
        with engine.connect() as lock_conn:
            if not lock_conn.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": SYNC_LOCK_ID}).scalar():
                log.info("Scheme folder sync already running in another process")
                return status()
            try:
                _sync(force)
            finally:
                lock_conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": SYNC_LOCK_ID})
                lock_conn.commit()
    except Exception as exc:  # noqa: BLE001
        log.exception("Scheme folder sync failed")
        _status["error"] = str(exc)[:500]
    finally:
        _status.update(running=False, current=None, finished_at=utcnow().isoformat())
        _run_lock.release()
    return status()


def _sync(force: bool) -> None:
    entries = scan()
    _status.update(running=True, total=len(entries), done=0, current=None, indexed=0, unchanged=0, skipped=0, failed=0,
                   removed=0, started_at=utcnow().isoformat(), finished_at=None, error=None)
    log.info("Scheme folder sync: %s documents in %s", len(entries), settings.scheme_path)
    wanted: set[str] = set()
    for e in entries:
        _status["current"] = e["slug"]
        doc_id = doc_id_for(e["slug"])
        wanted.add(doc_id)
        try:
            _sync_one(e, doc_id, force)
        except Exception:  # noqa: BLE001 – one bad page must not stop the rest
            log.exception("Failed to sync %s", e["slug"])
            _status["failed"] += 1
        _status["done"] += 1

    # Folders that disappeared: drop their documents, chunks and vectors.
    db = SessionLocal()
    try:
        for doc in db.scalars(select(KnowledgeDocument).where(KnowledgeDocument.kind == KIND)).all():
            if doc.id not in wanted:
                remove_document(db, doc)
                _status["removed"] += 1
    finally:
        db.close()
    log.info("Scheme folder sync finished: %s", {k: _status[k] for k in ("indexed", "unchanged", "skipped", "failed", "removed")})


def _text_of(raw: bytes) -> str:
    _, blocks = extract(raw, ".txt")
    return "\n\n".join(b["text"] for b in blocks)


def _has_enough_text(path: Path) -> bool:
    return len(_text_of(path.read_bytes()).strip()) >= MIN_CHARS


def _sync_one(e: dict, doc_id: str, force: bool) -> None:
    raw = e["text_path"].read_bytes()
    full_text = _text_of(raw)
    if len(full_text.strip()) < MIN_CHARS:
        _status["skipped"] += 1
        return

    meta = e["meta"]
    title = _clean_title(meta.get("title"), e["slug"])
    publisher, url = _publisher(meta)
    db = SessionLocal()
    try:
        doc = db.get(KnowledgeDocument, doc_id)
        # Same hash the pipeline stores, so unchanged text is recognised without re-embedding.
        if doc and not force and doc.status == "COMPLETE" and doc.content_hash == sha256(full_text):
            _status["unchanged"] += 1
            return
        if doc:
            doc.title, doc.publisher, doc.source_url, doc.file_path = title, publisher, url, str(e["text_path"])
            job = IngestionJob(document_id=doc.id, kind=KIND, title=title, status="UPLOADED",
                               stages=[{"stage": "UPLOADED", "at": utcnow().isoformat(), "detail": "Scheme folder re-sync"}])
            db.add(job)
        else:
            doc, job = create_document_record(
                db, doc_id=doc_id, title=title, kind=KIND, publisher=publisher, source_name=publisher, source_url=url,
                filename=f"{e['slug']}/content.txt", file_path=str(e["text_path"]), mime_type="text/plain")
        try:
            doc.retrieved_at = datetime.fromisoformat(meta["fetched_at"]) if meta.get("fetched_at") else None
        except ValueError:
            pass
        db.commit()
        job_id = job.id
    finally:
        db.close()

    run_job(job_id, raw=raw, ext=".txt")
    db = SessionLocal()
    try:
        ok = db.get(KnowledgeDocument, doc_id).status == "COMPLETE"
    finally:
        db.close()
    _status["indexed" if ok else "failed"] += 1


def folder_documents(db) -> list[dict]:
    """Every scheme-library document with its index state, for the admin Knowledge Base tab."""
    by_id = {d.id: d for d in db.scalars(select(KnowledgeDocument).where(KnowledgeDocument.kind == KIND)).all()}
    rows = []
    for e in scan():
        d = by_id.get(doc_id_for(e["slug"]))
        meta = e["meta"]
        state = d.status if d else "PENDING"
        if not d and not _has_enough_text(e["text_path"]):
            state = "NO_TEXT"  # skipped by the sync, not waiting for it
        rows.append({
            "slug": e["slug"], "title": _clean_title(meta.get("title"), e["slug"]), "category": meta.get("kind") or "page",
            "publisher": _publisher(meta)[0], "source_url": _publisher(meta)[1], "size": e["text_path"].stat().st_size,
            "document_id": d.id if d else None, "status": state, "chunk_count": d.chunk_count if d else 0,
            "language": d.language if d else None,
        })
    return rows


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    result = sync(force="--force" in sys.argv)
    print(json.dumps(result, indent=2))
