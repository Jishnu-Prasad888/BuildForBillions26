"""Citizen document wallet (kept intentionally simple)."""
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.config import settings
from app.database import get_db
from app.ingestion.extract import extract
from app.models import User, UserDocument

router = APIRouter(prefix="/api/documents", tags=["documents"])

DOC_TYPES = {"AADHAAR", "DRIVING_LICENCE", "LAND_RECORD", "BANK", "CERTIFICATE", "OTHER"}
WALLET_EXT = {".pdf", ".png", ".jpg", ".jpeg", ".txt"}


def doc_out(d: UserDocument) -> dict:
    return {"id": d.id, "doc_type": d.doc_type, "title": d.title, "filename": d.filename, "mime_type": d.mime_type, "size": d.size,
            "has_file": bool(d.file_path), "is_sample": d.is_sample, "extracted_text": (d.extracted_text or "")[:600],
            "created_at": d.created_at.isoformat()}


@router.get("")
def list_docs(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return [doc_out(d) for d in db.scalars(select(UserDocument).where(UserDocument.user_id == user.id).order_by(UserDocument.created_at.desc())).all()]


@router.post("", status_code=201)
async def upload_doc(doc_type: str = Form(...), title: str = Form(..., max_length=200), file: UploadFile | None = File(None),
                     user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if doc_type not in DOC_TYPES:
        raise HTTPException(422, "Invalid document type")
    d = UserDocument(user_id=user.id, doc_type=doc_type, title=title.strip())
    if file is not None and file.filename:
        ext = Path(file.filename).suffix.lower()
        if ext not in WALLET_EXT:
            raise HTTPException(422, f"Allowed file types: {', '.join(sorted(WALLET_EXT))}")
        data = await file.read()
        if len(data) > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(413, "File too large")
        folder = settings.upload_path / "wallet" / user.id
        folder.mkdir(parents=True, exist_ok=True)
        safe = re.sub(r"[^A-Za-z0-9._-]", "_", Path(file.filename).name)[-100:]
        path = folder / f"{uuid.uuid4().hex[:8]}_{safe}"
        path.write_bytes(data)
        d.filename, d.file_path, d.mime_type, d.size = file.filename, str(path), file.content_type, len(data)
        if ext in (".pdf", ".txt"):
            try:
                _, blocks = extract(data, ext)
                d.extracted_text = "\n".join(b["text"] for b in blocks)[:20000]
            except Exception:  # noqa: BLE001
                d.extracted_text = None
    db.add(d)
    db.commit()
    return doc_out(d)


@router.get("/{did}/file")
def download(did: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d = db.get(UserDocument, did)
    if not d or d.user_id != user.id or not d.file_path:
        raise HTTPException(404, "File not found")
    return FileResponse(d.file_path, filename=d.filename or "document", media_type=d.mime_type or "application/octet-stream")


@router.delete("/{did}")
def delete_doc(did: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    d = db.get(UserDocument, did)
    if not d or d.user_id != user.id:
        raise HTTPException(404, "Document not found")
    if d.file_path:
        Path(d.file_path).unlink(missing_ok=True)
    db.delete(d)
    db.commit()
    return {"ok": True}
