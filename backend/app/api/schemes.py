from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.database import get_db
from app.graph import get_graph
from app.kag.agent import scheme_card
from app.models import KnowledgeDocument, User
from app.services.forms import get_form

router = APIRouter(prefix="/api/schemes", tags=["schemes"])


@router.get("")
def list_schemes(lang: str = "en", user: User = Depends(get_current_user)):
    return [scheme_card(s, lang) for s in get_graph().list_schemes()]


@router.get("/life-events")
def life_events(user: User = Depends(get_current_user)):
    return [{"code": le["code"], "name": le["name"], "names": le.get("names", {}), "description": le.get("description")}
            for le in get_graph().life_events()]


@router.get("/forms/{form_id}")
def form_definition(form_id: str, user: User = Depends(get_current_user)):
    form = get_form(form_id)
    if not form:
        raise HTTPException(404, "Form not found")
    return form


@router.get("/{code}")
def get_scheme(code: str, lang: str = "en", user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = get_graph().get_scheme(code)
    if not s:
        raise HTTPException(404, "Scheme not found")
    docs = db.scalars(select(KnowledgeDocument).where(KnowledgeDocument.id.in_(s.get("source_docs") or []))).all()
    card = scheme_card(s, lang)
    card["sources"] = [{"id": d.id, "title": d.title, "publisher": d.publisher, "url": d.source_url, "is_demo": d.is_demo} for d in docs]
    card["graph"] = get_graph().graph_view(code)
    return card
