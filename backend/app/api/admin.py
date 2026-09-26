from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.auth.deps import require_admin
from app.config import settings
from app.database import get_db
from app.graph import get_graph
from app.ingestion.extract import ALLOWED_EXTENSIONS
from app import vectorstore
from app.ingestion import scheme_folder
from app.ingestion.pipeline import STAGES, create_document_record, reembed_all, remove_document, run_job, save_upload
from app.kag.agent import scheme_card
from app.models import Application, IngestionJob, KnowledgeChunk, KnowledgeDocument, KnowledgeSource, User
from app.schemas.common import AdminUserPatch, SchemeIn, SourceIn, UserOut
from app.services.ai import get_ai

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def job_out(j: IngestionJob) -> dict:
    return {"id": j.id, "document_id": j.document_id, "kind": j.kind, "title": j.title, "status": j.status, "stages": j.stages or [],
            "detail": j.detail or {}, "error": j.error, "created_at": j.created_at.isoformat(),
            "finished_at": j.finished_at.isoformat() if j.finished_at else None}


def doc_out(d: KnowledgeDocument, src: KnowledgeSource | None = None) -> dict:
    return {"id": d.id, "title": d.title, "publisher": d.publisher, "source_url": d.source_url, "filename": d.filename, "kind": d.kind,
            "language": d.language, "published_date": d.published_date, "is_demo": d.is_demo, "scheme_codes": d.scheme_codes or [],
            "status": d.status, "chunk_count": d.chunk_count, "content_hash": d.content_hash, "mime_type": d.mime_type,
            "source": {"id": src.id, "name": src.name, "is_official": src.is_official} if src else None,
            "retrieved_at": d.retrieved_at.isoformat() if d.retrieved_at else None, "created_at": d.created_at.isoformat()}


# ---------------------------------------------------------------- overview
@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    count = lambda m: db.scalar(select(func.count()).select_from(m))  # noqa: E731
    last = db.scalar(select(func.max(IngestionJob.finished_at)))
    jobs = db.scalars(select(IngestionJob).order_by(IngestionJob.created_at.desc()).limit(8)).all()
    by_model = db.execute(select(KnowledgeChunk.embedding_model, func.count()).group_by(KnowledgeChunk.embedding_model)).all()
    return {
        "documents": count(KnowledgeDocument), "sources": count(KnowledgeSource), "chunks": count(KnowledgeChunk),
        "users": count(User), "applications": count(Application),
        "graph": get_graph().stats(), "last_indexed": last.isoformat() if last else None,
        "recent_ingestion": [job_out(j) for j in jobs], "ai": get_ai().health(),
        "embeddings_by_model": [{"model": m, "chunks": c} for m, c in by_model],
        "vector_backend": settings.VECTOR_BACKEND, "pipeline_stages": STAGES,
        "vectors": vectorstore.info().get("vectors") if vectorstore.enabled() else None,
    }


# ---------------------------------------------------------------- users
@router.get("/users")
def users(q: str = "", db: Session = Depends(get_db)):
    stmt = select(User).order_by(User.created_at.desc())
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(User.email).like(like), func.lower(User.full_name).like(like)))
    rows = db.scalars(stmt.limit(200)).all()
    counts = dict(db.execute(select(Application.user_id, func.count()).group_by(Application.user_id)).all())
    return [{**UserOut.model_validate(u).model_dump(mode="json"), "applications": counts.get(u.id, 0)} for u in rows]


@router.patch("/users/{uid}")
def patch_user(uid: str, body: AdminUserPatch, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    u = db.get(User, uid)
    if not u:
        raise HTTPException(404, "User not found")
    if u.id == admin.id and (body.is_active is False or body.role == "USER"):
        raise HTTPException(400, "You cannot disable or demote your own account")
    if body.role:
        u.role = body.role
    if body.is_active is not None:
        u.is_active = body.is_active
    db.commit()
    return UserOut.model_validate(u)


# ---------------------------------------------------------------- documents
@router.get("/documents")
def documents(db: Session = Depends(get_db)):
    rows = db.execute(select(KnowledgeDocument, KnowledgeSource).outerjoin(KnowledgeSource, KnowledgeDocument.source_id == KnowledgeSource.id)
                      .order_by(KnowledgeDocument.created_at.desc())).all()
    return [doc_out(d, s) for d, s in rows]


@router.post("/documents", status_code=202)
async def upload_document(background: BackgroundTasks, file: UploadFile = File(...), title: str = Form(""), publisher: str = Form(""),
                          source_name: str = Form(""), source_url: str = Form(""), published_date: str = Form(""),
                          is_demo: bool = Form(False), scheme_codes: str = Form(""), admin: User = Depends(require_admin),
                          db: Session = Depends(get_db)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(422, f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")
    data = await file.read()
    if len(data) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(413, "File too large")
    if not data:
        raise HTTPException(422, "Empty file")
    if ext == ".pdf" and not data.startswith(b"%PDF"):
        raise HTTPException(422, "File content is not a valid PDF")
    path = save_upload(data, file.filename)
    codes = [c.strip() for c in scheme_codes.split(",") if c.strip()]
    doc, job = create_document_record(
        db, title=title.strip() or file.filename, kind="upload", publisher=publisher.strip(), source_name=source_name.strip() or publisher.strip() or None,
        source_url=source_url.strip() or None, filename=file.filename, file_path=str(path), mime_type=ALLOWED_EXTENSIONS[ext],
        published_date=published_date or None, is_demo=is_demo, scheme_codes=codes, uploaded_by=admin.id)
    background.add_task(run_job, job.id)
    return {"document": doc_out(doc), "job": job_out(job)}


@router.get("/documents/{did}")
def document(did: str, db: Session = Depends(get_db)):
    d = db.get(KnowledgeDocument, did)
    if not d:
        raise HTTPException(404, "Document not found")
    src = db.get(KnowledgeSource, d.source_id) if d.source_id else None
    chunks = db.scalars(select(KnowledgeChunk).where(KnowledgeChunk.document_id == did).order_by(KnowledgeChunk.chunk_index)).all()
    jobs = db.scalars(select(IngestionJob).where(IngestionJob.document_id == did).order_by(IngestionJob.created_at.desc())).all()
    return {**doc_out(d, src), "jobs": [job_out(j) for j in jobs], "chunks": [{
        "chunk_id": c.id, "document_id": c.document_id, "chunk_index": c.chunk_index, "content": c.content, "section": c.section,
        "page": c.page, "language": c.language, "scheme_codes": c.scheme_codes, "content_hash": c.content_hash,
        "embedding_model": c.embedding_model, "source_url": d.source_url, "source_title": d.title, "publisher": d.publisher,
        "published_date": d.published_date, "retrieved_at": (d.retrieved_at or d.created_at).isoformat(),
    } for c in chunks]}


@router.delete("/documents/{did}")
def delete_document(did: str, db: Session = Depends(get_db)):
    d = db.get(KnowledgeDocument, did)
    if not d:
        raise HTTPException(404, "Document not found")
    remove_document(db, d)
    return {"ok": True}


@router.post("/documents/{did}/reindex", status_code=202)
def reindex(did: str, background: BackgroundTasks, db: Session = Depends(get_db)):
    d = db.get(KnowledgeDocument, did)
    if not d:
        raise HTTPException(404, "Document not found")
    if d.kind == "seed":
        raise HTTPException(400, "Seed documents are re-indexed on startup")
    job = IngestionJob(document_id=d.id, kind=d.kind, title=d.title, status="UPLOADED", stages=[{"stage": "UPLOADED", "at": d.created_at.isoformat(), "detail": "Re-index"}])
    db.add(job)
    db.commit()
    background.add_task(run_job, job.id)
    return job_out(job)


@router.post("/reembed")
def reembed(db: Session = Depends(get_db)):
    return reembed_all(db)


# ---------------------------------------------------------------- scheme library (Chroma)
@router.get("/knowledge")
def knowledge(db: Session = Depends(get_db)):
    """The scheme-folder library, its sync progress and the vector index it feeds."""
    docs = scheme_folder.folder_documents(db)
    vs = vectorstore.info() if vectorstore.enabled() else {"backend": settings.VECTOR_BACKEND, "vectors": None, "status": "not in use"}
    return {
        "folder": {"path": str(settings.scheme_path), "exists": settings.scheme_path.is_dir(), "documents": len(docs),
                   "indexed": sum(d["status"] == "COMPLETE" for d in docs),
                   "chunks": sum(d["chunk_count"] for d in docs)},
        "sync": scheme_folder.status(),
        "vector_store": vs,
        "embedding_model": get_ai().embedding_model_id,
        "documents": docs,
    }


@router.post("/knowledge/sync", status_code=202)
def knowledge_sync(force: bool = False):
    if not settings.scheme_path.is_dir():
        raise HTTPException(404, f"Scheme folder not found: {settings.scheme_path}")
    started = scheme_folder.start_background(force=force)
    return {"started": started, "sync": scheme_folder.status()}


# ---------------------------------------------------------------- sources
@router.get("/sources")
def sources(db: Session = Depends(get_db)):
    rows = db.execute(select(KnowledgeSource, func.count(KnowledgeDocument.id)).outerjoin(KnowledgeDocument, KnowledgeDocument.source_id == KnowledgeSource.id)
                      .group_by(KnowledgeSource.id).order_by(KnowledgeSource.created_at.desc())).all()
    return [{"id": s.id, "name": s.name, "publisher": s.publisher, "base_url": s.base_url, "category": s.category,
             "is_official": s.is_official, "is_demo": s.is_demo, "documents": n, "created_at": s.created_at.isoformat()} for s, n in rows]


@router.post("/sources", status_code=202)
def add_source(body: SourceIn, background: BackgroundTasks, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    from urllib.parse import urlparse

    host = urlparse(body.url).netloc
    doc, job = create_document_record(db, title=body.title or body.url, kind="web", publisher=body.publisher or host, source_name=host,
                                      source_url=body.url, scheme_codes=body.scheme_codes, uploaded_by=admin.id, mime_type="text/html")
    background.add_task(run_job, job.id)
    return {"document": doc_out(doc), "job": job_out(job)}


# ---------------------------------------------------------------- ingestion
@router.get("/ingestion")
def ingestion(db: Session = Depends(get_db)):
    return [job_out(j) for j in db.scalars(select(IngestionJob).order_by(IngestionJob.created_at.desc()).limit(100)).all()]


@router.get("/ingestion/{jid}")
def ingestion_job(jid: str, db: Session = Depends(get_db)):
    j = db.get(IngestionJob, jid)
    if not j:
        raise HTTPException(404, "Job not found")
    return job_out(j)


# ---------------------------------------------------------------- schemes / graph
@router.get("/schemes")
def schemes():
    g = get_graph()
    return {"schemes": [scheme_card(s, "en") | {"life_events": s["life_events"], "states": s["states"], "source_docs": s["source_docs"]}
                        for s in g.list_schemes()],
            "stats": g.stats()}


@router.post("/schemes", status_code=201)
def create_scheme(body: SchemeIn):
    g = get_graph()
    data = body.model_dump()
    data["rules"] = [{"code": r.get("code") or f"{body.code}_R{i + 1}", "text": r["text"], "field": r.get("field", ""),
                      "supported_by": r.get("supported_by") or body.source_doc} for i, r in enumerate(body.rules) if r.get("text")]
    data["short_name"] = body.short_name or body.name
    g.upsert_scheme(data)
    return scheme_card(g.get_scheme(body.code), "en")


@router.get("/graph")
def graph(scheme: str | None = None):
    return get_graph().graph_view(scheme)
