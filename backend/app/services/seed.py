"""Idempotent startup seeding: demo users, graph, seed knowledge documents, demo applications."""
from __future__ import annotations

import json
import logging
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.config import settings
from app.graph import get_graph
from app.ingestion.extract import parse_front_matter
from app.ingestion.pipeline import create_document_record, reembed_all, run_job
from app.models import Application, KnowledgeChunk, KnowledgeDocument, KnowledgeSource, Note, User, UserDocument
from app.models.common import utcnow
from app.services.ai import get_ai

log = logging.getLogger(__name__)

DEMO_USERS = [
    {"email": "admin@demo.gov.in", "full_name": "Anita Rao (Admin)", "password": "Admin@123", "role": "ADMIN", "profile": {}},
    {"email": "ramesh@demo.in", "full_name": "Ramesh Gowda", "password": "Demo@123", "role": "USER",
     "profile": {"phone": "9876543210", "state": "Karnataka", "district": "Mandya", "taluk": "Maddur", "village": "Koppa",
                 "occupation": "Farmer", "land_acres": 3}},
    {"email": "lakshmi@demo.in", "full_name": "Lakshmi Devi", "password": "Demo@123", "role": "USER", "preferred_language": "kn",
     "profile": {"state": "Karnataka", "district": "Hassan", "occupation": "Farmer"}},
    {"email": "suresh@demo.in", "full_name": "Suresh Kumar", "password": "Demo@123", "role": "USER", "is_active": False,
     "preferred_language": "hi", "profile": {"state": "Karnataka", "district": "Raichur"}},
]


def seed_users(db: Session) -> None:
    for u in DEMO_USERS:
        if db.scalars(select(User).where(User.email == u["email"])).first():
            continue
        db.add(User(email=u["email"], full_name=u["full_name"], password_hash=hash_password(u["password"]), role=u["role"],
                    profile=u["profile"], is_active=u.get("is_active", True), preferred_language=u.get("preferred_language", "en")))
    db.commit()


def seed_graph() -> None:
    g = get_graph()
    data = json.loads((settings.seed_path / "graph.json").read_text(encoding="utf-8"))
    if g.is_empty():
        log.info("Seeding knowledge graph (%s)", g.backend)
        g.seed(data)


def seed_documents(db: Session) -> None:
    folder = settings.seed_path / "documents"
    for path in sorted(folder.glob("*.md")):
        raw = path.read_bytes()
        meta, _ = parse_front_matter(raw.decode("utf-8"))
        slug = meta.get("slug") or path.stem
        if db.get(KnowledgeDocument, slug):
            continue
        log.info("Indexing seed document %s", slug)
        doc, job = create_document_record(
            db, doc_id=slug, title=meta.get("title", path.stem), kind="seed", publisher=meta.get("publisher", ""),
            source_name=meta.get("source_name"), source_url=meta.get("source_url"), filename=path.name, mime_type="text/markdown",
            language=meta.get("language", "en"), published_date=meta.get("published_date"), is_demo=bool(meta.get("is_demo", True)),
            scheme_codes=meta.get("schemes") or [],
        )
        run_job(job.id, raw=raw, ext=".md")


def resync_graph_documents(db: Session) -> None:
    """In-memory graph loses document links on restart; re-link from PostgreSQL."""
    g = get_graph()
    rows = db.execute(select(KnowledgeDocument, KnowledgeSource).outerjoin(KnowledgeSource, KnowledgeDocument.source_id == KnowledgeSource.id)
                      .where(KnowledgeDocument.status == "COMPLETE")).all()
    for doc, src in rows:
        g.upsert_document(doc.id, doc.title, src.name if src else doc.publisher, doc.publisher, doc.scheme_codes or [])


def maybe_reembed(db: Session) -> None:
    ai = get_ai()
    if not ai.embeddings_available():
        return
    stale = db.scalar(select(func.count()).select_from(KnowledgeChunk).where(KnowledgeChunk.embedding_model != ai.embedding_model_id))
    if stale:
        log.info("Re-embedding %s chunks with %s", stale, ai.embedding_model_id)
        reembed_all(db)


def seed_citizen_data(db: Session) -> None:
    user = db.scalars(select(User).where(User.email == "ramesh@demo.in")).first()
    if not user or db.scalars(select(Application).where(Application.user_id == user.id)).first():
        return
    now = utcnow()
    db.add_all([
        UserDocument(user_id=user.id, doc_type="AADHAAR", title="Aadhaar card (sample)", is_sample=True,
                     extracted_text="SAMPLE — not a real Aadhaar. Name: Ramesh Gowda"),
        UserDocument(user_id=user.id, doc_type="BANK", title="SBI passbook – first page (sample)", is_sample=True,
                     extracted_text="SAMPLE — Account holder: Ramesh Gowda. Branch: Maddur"),
    ])
    db.add(Application(
        user_id=user.id, scheme_code="PM_KISAN", scheme_name="PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)", status="SUBMITTED",
        progress=100, reference_number="DEMO-PMK-2026-4471", submitted_at=now - timedelta(days=41),
        timeline=[
            {"status": "CREATED", "at": (now - timedelta(days=45)).isoformat(), "note": "Application started"},
            {"status": "SUBMITTED", "at": (now - timedelta(days=41)).isoformat(), "note": "DEMO submission recorded (not sent to any government portal)"},
        ],
        created_at=now - timedelta(days=45),
    ))
    db.add(Application(
        user_id=user.id, scheme_code="PMFBY", scheme_name="Pradhan Mantri Fasal Bima Yojana (PMFBY) – Crop Insurance Claim",
        status="DOCUMENTS_REQUIRED", progress=60,
        timeline=[
            {"status": "CREATED", "at": (now - timedelta(days=3)).isoformat(), "note": "Claim tracker created"},
            {"status": "DOCUMENTS_REQUIRED", "at": (now - timedelta(days=2)).isoformat(), "note": "Sowing certificate and land record needed"},
        ],
        created_at=now - timedelta(days=3),
    ))
    db.add_all([
        Note(user_id=user.id, kind="USER", item_type="todo", content="Find bank IFSC code", position=0),
        Note(user_id=user.id, kind="USER", item_type="question", content="Do I need an income certificate?", position=1),
    ])
    db.commit()


def run_all(db: Session) -> None:
    seed_users(db)
    seed_graph()
    seed_documents(db)
    resync_graph_documents(db)
    maybe_reembed(db)
    seed_citizen_data(db)
