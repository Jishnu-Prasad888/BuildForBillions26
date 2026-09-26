"""Private, per-user file storage.

    <FORMS_DIR>/<user_id>/forms/<form_id>/original/original.<ext>   immutable upload
                                          /processed/page-001.png   derived page images
                                          /output/completed.pdf     generated result

Paths are built only from server-generated hex IDs, never from user input, and are checked to stay
inside the storage root. The original file is written exclusively (never overwritten) and made read-only.
"""
from __future__ import annotations

import logging
import os
import re
import shutil
from pathlib import Path

from app.config import settings

log = logging.getLogger("forms.storage")
_ID = re.compile(r"^[0-9a-f]{32}$")


class StorageError(RuntimeError):
    pass


def _root() -> Path:
    return settings.forms_path.resolve()


def form_dir(user_id: str, form_id: str) -> Path:
    if not _ID.fullmatch(user_id or "") or not _ID.fullmatch(form_id or ""):
        raise StorageError("invalid identifier")
    p = (_root() / user_id / "forms" / form_id).resolve()
    if _root() not in p.parents:
        raise StorageError("path escapes storage root")
    return p


def original_dir(user_id: str, form_id: str) -> Path:
    return form_dir(user_id, form_id) / "original"


def processed_dir(user_id: str, form_id: str) -> Path:
    return form_dir(user_id, form_id) / "processed"


def output_dir(user_id: str, form_id: str) -> Path:
    return form_dir(user_id, form_id) / "output"


def original_path(user_id: str, form_id: str, stored_filename: str) -> Path:
    if not re.fullmatch(r"original\.(pdf|jpg|png|webp)", stored_filename):
        raise StorageError("invalid stored filename")
    return original_dir(user_id, form_id) / stored_filename


def page_image_path(user_id: str, form_id: str, page_number: int) -> Path:
    return processed_dir(user_id, form_id) / f"page-{int(page_number):03d}.png"


def completed_path(user_id: str, form_id: str) -> Path:
    return output_dir(user_id, form_id) / "completed.pdf"


def store_original(user_id: str, form_id: str, ext: str, data: bytes) -> str:
    """Writes the upload once. Fails if the file exists; the file is then made read-only."""
    stored = f"original.{ext}"
    path = original_path(user_id, form_id, stored)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "xb") as fh:
        fh.write(data)
        fh.flush()
        os.fsync(fh.fileno())
    os.chmod(path, 0o400)
    return stored


def _trash_name(form_id: str) -> str:
    return f".trash-{form_id}"


def remove_form_files(user_id: str, form_id: str) -> Path | None:
    """Step 1 of deletion: atomically move the folder aside so a half-deleted form is never visible.
    Returns the trash path (or None if there was nothing on disk). Finish with ``purge_trash``."""
    src = form_dir(user_id, form_id)
    if not src.exists():
        return None
    dst = src.parent / _trash_name(form_id)
    if dst.exists():
        shutil.rmtree(dst, ignore_errors=True)
    src.rename(dst)
    return dst


def restore_form_files(trash: Path | None, user_id: str, form_id: str) -> None:
    if trash is not None and trash.exists():
        trash.rename(form_dir(user_id, form_id))


def purge_trash(user_id: str) -> None:
    """Step 2 of deletion (also sweeps leftovers of an earlier crash)."""
    base = _root() / user_id / "forms"
    if not base.is_dir() or not _ID.fullmatch(user_id):
        return
    for child in base.iterdir():
        if child.name.startswith(".trash-"):
            shutil.rmtree(child, ignore_errors=True)
            if child.exists():
                log.warning("Could not purge %s", child.name)


def sha256_file(path: Path) -> str:
    import hashlib

    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()
