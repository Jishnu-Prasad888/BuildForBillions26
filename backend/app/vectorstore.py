"""ChromaDB vector index for knowledge chunks (VECTOR_BACKEND=chroma).

PostgreSQL stays the system of record for chunk text and metadata (and serves keyword search);
Chroma holds one vector per chunk, keyed by the same chunk id, and answers nearest-neighbour queries.
Embeddings are always computed by our AI provider, never by Chroma, so the model is the same one
used for queries.
"""
from __future__ import annotations

import logging
import threading

from app.config import settings

log = logging.getLogger(__name__)

_lock = threading.Lock()
_client = None
_collection = None


def enabled() -> bool:
    return settings.VECTOR_BACKEND == "chroma"


def _get_client():
    global _client
    if _client is None:
        import chromadb
        from chromadb.config import Settings as ChromaSettings

        cs = ChromaSettings(anonymized_telemetry=False)
        if settings.CHROMA_HOST:
            _client = chromadb.HttpClient(host=settings.CHROMA_HOST, port=settings.CHROMA_PORT, settings=cs)
        else:
            _client = chromadb.PersistentClient(path=str(settings.chroma_path), settings=cs)
    return _client


def collection():
    global _collection
    if _collection is None:
        with _lock:
            if _collection is None:
                _collection = _get_client().get_or_create_collection(
                    settings.CHROMA_COLLECTION, metadata={"hnsw:space": "cosine"}, embedding_function=None)
    return _collection


def reset() -> None:
    """Drop and recreate the collection (needed when the embedding dimension changes)."""
    global _collection
    with _lock:
        client = _get_client()
        try:
            client.delete_collection(settings.CHROMA_COLLECTION)
        except Exception:  # noqa: BLE001 – already absent
            pass
        _collection = None
    collection()


def upsert(ids: list[str], vectors: list[list[float]], metadatas: list[dict], batch: int = 500) -> None:
    col = collection()
    for i in range(0, len(ids), batch):
        col.upsert(ids=ids[i:i + batch], embeddings=vectors[i:i + batch], metadatas=metadatas[i:i + batch])


def delete_document(document_id: str) -> None:
    collection().delete(where={"document_id": document_id})


def query(vector: list[float], model_id: str, limit: int = 20) -> list[tuple[str, float]]:
    """Nearest chunks embedded with `model_id`, as (chunk_id, cosine similarity)."""
    col = collection()
    if col.count() == 0:
        return []
    res = col.query(query_embeddings=[vector], n_results=limit, where={"embedding_model": model_id}, include=["distances"])
    return [(cid, 1.0 - float(d)) for cid, d in zip(res["ids"][0], res["distances"][0])]


def count() -> int:
    return collection().count()


def info() -> dict:
    out = {"backend": "chroma", "collection": settings.CHROMA_COLLECTION,
           "location": f"{settings.CHROMA_HOST}:{settings.CHROMA_PORT}" if settings.CHROMA_HOST else str(settings.chroma_path)}
    try:
        out["vectors"] = count()
        out["status"] = "connected"
    except Exception as exc:  # noqa: BLE001
        log.warning("Chroma unavailable: %s", exc)
        out["vectors"] = None
        out["status"] = "unavailable"
    return out
