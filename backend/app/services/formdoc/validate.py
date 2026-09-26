"""Upload validation. Nothing the browser says (filename, MIME type) is trusted: the bytes decide."""
from __future__ import annotations

import hashlib
import io
import re
from dataclasses import dataclass

from app.config import settings

ALLOWED_EXT = {".pdf": "pdf", ".jpg": "jpeg", ".jpeg": "jpeg", ".png": "png", ".webp": "webp"}
MIME_BY_KIND = {"pdf": "application/pdf", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
STORE_EXT = {"pdf": "pdf", "jpeg": "jpg", "png": "png", "webp": "webp"}
MAX_IMAGE_PIXELS = 80_000_000


class UploadRejected(ValueError):
    def __init__(self, message: str, status: int = 422):
        super().__init__(message)
        self.status = status


@dataclass
class ValidatedUpload:
    kind: str  # pdf | image
    file_kind: str  # pdf | jpeg | png | webp
    store_ext: str
    mime: str
    display_name: str
    sha256: str
    size: int
    page_count: int


def sniff(data: bytes) -> str | None:
    """File type from magic bytes."""
    if data.startswith(b"%PDF-"):
        return "pdf"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def clean_filename(name: str | None) -> tuple[str, str]:
    """Returns (display_name, extension). The name is only ever displayed, never used as a path."""
    name = (name or "").strip()
    if not name:
        raise UploadRejected("The file has no name.")
    if len(name) > 255:
        raise UploadRejected("The file name is too long.")
    if "\x00" in name or re.search(r"[\x00-\x1f\x7f]", name):
        raise UploadRejected("The file name contains invalid characters.")
    if "/" in name or "\\" in name or ".." in name or name.startswith("~"):
        raise UploadRejected("The file name is not allowed.")
    m = re.search(r"(\.[A-Za-z0-9]{1,5})$", name)
    ext = m.group(1).lower() if m else ""
    if ext not in ALLOWED_EXT:
        raise UploadRejected("Unsupported file type. Upload a PDF, JPG, PNG or WebP file.")
    return name, ext


def validate_upload(filename: str | None, declared_mime: str | None, data: bytes) -> ValidatedUpload:
    display, ext = clean_filename(filename)
    if not data:
        raise UploadRejected("The file is empty.")
    if len(data) > settings.max_form_bytes:
        raise UploadRejected(f"The file is too large. The limit is {settings.MAX_FORM_SIZE_MB} MB.", 413)
    kind = sniff(data)
    if kind is None:
        raise UploadRejected("This file is not a valid PDF or image.")
    if ALLOWED_EXT[ext] != kind:
        raise UploadRejected("The file content does not match its extension.")
    declared = (declared_mime or "").split(";")[0].strip().lower()
    if declared in ("image/jpg", "image/pjpeg"):
        declared = "image/jpeg"
    if declared and declared not in ("application/octet-stream", MIME_BY_KIND[kind]):
        raise UploadRejected("The file type reported by your browser does not match the file content.")

    if kind == "pdf":
        page_count = _check_pdf(data)
        return ValidatedUpload("pdf", kind, STORE_EXT[kind], MIME_BY_KIND[kind], display, hashlib.sha256(data).hexdigest(), len(data), page_count)
    _check_image(data)
    return ValidatedUpload("image", kind, STORE_EXT[kind], MIME_BY_KIND[kind], display, hashlib.sha256(data).hexdigest(), len(data), 1)


def _check_pdf(data: bytes) -> int:
    import fitz

    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:  # noqa: BLE001
        raise UploadRejected("This PDF could not be opened. It may be damaged.") from exc
    try:
        if doc.needs_pass or doc.is_encrypted:
            raise UploadRejected("This PDF is password protected. Remove the password and upload it again.")
        n = doc.page_count
        if n < 1:
            raise UploadRejected("This PDF has no pages.")
        if n > settings.MAX_FORM_PAGES:
            raise UploadRejected(f"This PDF has too many pages (limit {settings.MAX_FORM_PAGES}).")
        return n
    finally:
        doc.close()


def _check_image(data: bytes) -> None:
    from PIL import Image

    try:
        with Image.open(io.BytesIO(data)) as im:
            w, h = im.size
            if w * h > MAX_IMAGE_PIXELS:
                raise UploadRejected("This image is too large to process.")
            if w < 200 or h < 200:
                raise UploadRejected("This image is too small to read. Please upload a clearer image.")
            im.verify()
    except UploadRejected:
        raise
    except Exception as exc:  # noqa: BLE001
        raise UploadRejected("This image could not be read. It may be damaged.") from exc
