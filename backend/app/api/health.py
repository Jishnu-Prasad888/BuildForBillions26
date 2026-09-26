from fastapi import APIRouter
from sqlalchemy import text

from app.config import settings
from app.database import engine
from app.graph import get_graph
from app.ratelimit import get_limiter
from app.services.ai import get_ai

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("")
def health():
    try:
        with engine.connect() as c:
            c.execute(text("SELECT 1"))
        db_ok = True
    except Exception:  # noqa: BLE001
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "database": "connected" if db_ok else "unavailable",
            "vector_backend": settings.VECTOR_BACKEND, "graph_backend": get_graph().backend, "demo_mode": settings.DEMO_MODE,
            "rate_limit": get_limiter().backend if settings.RATE_LIMIT_ENABLED else "disabled"}


@router.get("/ai")
def health_ai():
    """Provider/model status. Never exposes API keys."""
    return get_ai().health()
