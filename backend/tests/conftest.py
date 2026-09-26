"""Test environment: SQLite + a temp storage root, so no Postgres/Neo4j/Ollama/containers are needed."""
import os
import sys
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="forms-test-"))
os.environ.update(
    DATABASE_URL=f"sqlite:///{_TMP}/test.db", VECTOR_BACKEND="json", FORMS_DIR=str(_TMP / "users"), UPLOAD_DIR=str(_TMP / "uploads"),
    RATE_LIMIT_ENABLED="false", OLLAMA_BASE_URL="http://127.0.0.1:9", TELEGRAM_BOT_TOKEN="", NEO4J_URI="bolt://127.0.0.1:9", APP_ENV="development",
)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import models  # noqa: E402,F401
from app.auth.security import create_access_token, hash_password  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _schema():
    Base.metadata.create_all(engine)
    yield


def _make_user(email: str, name: str, profile: dict | None = None) -> dict:
    db = SessionLocal()
    try:
        u = User(email=email, full_name=name, password_hash=hash_password("Test@12345"), profile=profile or {})
        db.add(u)
        db.commit()
        return {"id": u.id, "headers": {"Authorization": f"Bearer {create_access_token(u.id, 'USER')}"}}
    finally:
        db.close()


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def alice():
    return _make_user(f"alice-{os.urandom(3).hex()}@test.in", "Alice Rao", {"phone": "9876543210", "state": "Karnataka", "district": "Mandya"})


@pytest.fixture()
def bob():
    return _make_user(f"bob-{os.urandom(3).hex()}@test.in", "Bob Nair")


@pytest.fixture(scope="session")
def storage_root() -> Path:
    return _TMP / "users"
