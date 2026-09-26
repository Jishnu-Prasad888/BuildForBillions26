from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.database import get_db
from app.models import Application, Note, User
from app.schemas.common import NoteIn, NotePatch

router = APIRouter(prefix="/api/notes", tags=["notes"])


def note_out(n: Note) -> dict:
    return {"id": n.id, "application_id": n.application_id, "kind": n.kind, "item_type": n.item_type, "content": n.content,
            "data": n.data or {}, "done": n.done, "origin": n.origin, "position": n.position,
            "created_at": n.created_at.isoformat(), "updated_at": n.updated_at.isoformat()}


@router.get("")
def list_notes(application_id: str | None = None, kind: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = select(Note).where(Note.user_id == user.id)
    if application_id:
        q = q.where((Note.application_id == application_id) | ((Note.application_id.is_(None)) & (Note.kind == "USER")))
    if kind:
        q = q.where(Note.kind == kind)
    return [note_out(n) for n in db.scalars(q.order_by(Note.kind, Note.position, Note.created_at)).all()]


@router.post("", status_code=201)
def create_note(body: NoteIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.application_id:
        app = db.get(Application, body.application_id)
        if not app or app.user_id != user.id:
            raise HTTPException(404, "Application not found")
    pos = (db.scalar(select(func.max(Note.position)).where(Note.user_id == user.id)) or 0) + 1
    n = Note(user_id=user.id, application_id=body.application_id, kind="USER", item_type=body.item_type,
             content=body.content.strip(), origin=body.origin, position=pos)
    db.add(n)
    db.commit()
    return note_out(n)


def _own_user_note(db: Session, nid: str, user: User) -> Note:
    n = db.get(Note, nid)
    if not n or n.user_id != user.id:
        raise HTTPException(404, "Note not found")
    if n.kind != "USER":
        raise HTTPException(400, "AI notes are generated automatically and cannot be edited")
    return n


@router.patch("/{nid}")
def update_note(nid: str, body: NotePatch, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = _own_user_note(db, nid, user)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(n, k, v)
    db.commit()
    return note_out(n)


@router.delete("/{nid}")
def delete_note(nid: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = _own_user_note(db, nid, user)
    db.delete(n)
    db.commit()
    return {"ok": True}
