"""AI Form Assistant tables. Every table carries ``user_id`` so that no query can be written without an owner."""
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.common import new_id, utcnow


class Form(Base):
    """Metadata of one uploaded form. The file itself lives in private storage, never in the database."""

    __tablename__ = "forms"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    original_filename: Mapped[str] = mapped_column(String(255))  # display only; never used as a path
    stored_filename: Mapped[str] = mapped_column(String(64))  # server-generated, e.g. original.pdf
    mime_type: Mapped[str] = mapped_column(String(64))
    kind: Mapped[str] = mapped_column(String(8))  # pdf | image
    file_size: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    # UPLOADED | ANALYZING | READY | FAILED | COMPLETED
    status: Mapped[str] = mapped_column(String(16), default="UPLOADED")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    analysis: Mapped[dict] = mapped_column(JSON, default=dict)  # summary: fillable, scanned pages, warnings
    output_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class FormPage(Base):
    __tablename__ = "form_pages"
    __table_args__ = (UniqueConstraint("form_id", "page_number"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    form_id: Mapped[str] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    page_number: Mapped[int] = mapped_column(Integer)
    # Coordinate space of every bbox on this page: PDF points for PDFs, pixels of processed/page-NNN.png for images.
    width: Mapped[float] = mapped_column(Float)
    height: Mapped[float] = mapped_column(Float)
    text_source: Mapped[str] = mapped_column(String(8), default="pdf")  # pdf | ocr | none
    ocr_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    extracted_text: Mapped[str] = mapped_column(Text, default="")
    blocks: Mapped[list] = mapped_column(JSON, default=list)  # [{text, bbox, confidence}]
    warnings: Mapped[list] = mapped_column(JSON, default=list)
    # Document structure found on this page: {"title", "sections", "elements": [...]}. Every element keeps its
    # text, type, bbox and confidence, so "what is physically on this page" never has to be re-derived from OCR.
    structure: Mapped[dict] = mapped_column(JSON, default=dict)


class FormField(Base):
    __tablename__ = "form_fields"
    __table_args__ = (UniqueConstraint("form_id", "field_id"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    form_id: Mapped[str] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    field_id: Mapped[str] = mapped_column(String(32))  # field_001 ... (stable, never reused)
    label: Mapped[str] = mapped_column(String(255))  # exactly as printed on the form (for rendering)
    normalized_label: Mapped[str] = mapped_column(String(64), default="")  # applicant_name, father_or_spouse_name, ...
    description: Mapped[str] = mapped_column(Text, default="")
    type: Mapped[str] = mapped_column(String(24), default="text")
    input_type: Mapped[str] = mapped_column(String(16), default="text")  # text | date | choice | checkbox | signature | photo | ...
    page: Mapped[int] = mapped_column(Integer, default=1)
    bbox: Mapped[list] = mapped_column(JSON, default=list)  # [x0, y0, x1, y1] of the *input area*
    label_bbox: Mapped[list] = mapped_column(JSON, default=list)  # [x0, y0, x1, y1] of the printed label
    options: Mapped[list] = mapped_column(JSON, default=list)
    required: Mapped[bool] = mapped_column(Boolean, default=True)
    conditional: Mapped[bool] = mapped_column(Boolean, default=False)  # only relevant when meta["when"] holds
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    source: Mapped[str] = mapped_column(String(16), default="layout")  # acroform | layout | table | area | user
    section: Mapped[str] = mapped_column(String(120), default="")  # nearest heading, e.g. "Identity Details"
    meta: Mapped[dict] = mapped_column(JSON, default=dict)  # option_boxes, when, acro field name, ...
    position: Mapped[int] = mapped_column(Integer, default=0)  # reading order: page -> section -> y -> x
    # detected = a real field of the form (counted, asked about);
    # uncertain = a plausible label with no drawn evidence, waiting for the citizen in the review panel;
    # rejected   = the citizen looked at it and said it is not a field.
    status: Mapped[str] = mapped_column(String(16), default="detected")


class FormValue(Base):
    __tablename__ = "form_values"
    __table_args__ = (UniqueConstraint("form_id", "field_id"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    form_id: Mapped[str] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    field_id: Mapped[str] = mapped_column(String(32))
    value: Mapped[dict] = mapped_column(JSON, default=dict)  # {"v": <str|bool>} ; "blank": true = deliberately left empty
    source: Mapped[str] = mapped_column(String(12), default="user")  # user | assistant | profile
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class FormAssistanceSession(Base):
    __tablename__ = "form_assistance_sessions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    form_id: Mapped[str] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    language: Mapped[str] = mapped_column(String(8), default="en")
    screen_shared: Mapped[bool] = mapped_column(Boolean, default=False)
    state: Mapped[dict] = mapped_column(JSON, default=dict)  # asking, clarify, skipped, history (redacted)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class FormNote(Base):
    """The citizen's own notes for one form. AI notes are derived on demand and never stored here."""

    __tablename__ = "form_notes"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    form_id: Mapped[str] = mapped_column(ForeignKey("forms.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    content: Mapped[str] = mapped_column(Text, default="")
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
