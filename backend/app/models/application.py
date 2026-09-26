from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.common import new_id, utcnow


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    scheme_code: Mapped[str] = mapped_column(String(64))
    scheme_name: Mapped[str] = mapped_column(String(255))
    form_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # DRAFT | IN_PROGRESS | DOCUMENTS_REQUIRED | SUBMITTED | UNDER_REVIEW | APPROVED
    status: Mapped[str] = mapped_column(String(24), default="IN_PROGRESS")
    form_data: Mapped[dict] = mapped_column(JSON, default=dict)
    field_status: Mapped[dict] = mapped_column(JSON, default=dict)  # field_id -> COMPLETE | PENDING | SKIPPED
    progress: Mapped[int] = mapped_column(Integer, default=0)
    last_completed_section: Mapped[str | None] = mapped_column(String(128), nullable=True)
    next_section: Mapped[str | None] = mapped_column(String(128), nullable=True)
    reference_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    timeline: Mapped[list] = mapped_column(JSON, default=list)
    evidence: Mapped[list] = mapped_column(JSON, default=list)  # evidence used while discovering/applying
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class UserDocument(Base):
    """Citizen document wallet entry."""

    __tablename__ = "user_documents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    doc_type: Mapped[str] = mapped_column(String(32))  # AADHAAR | DRIVING_LICENCE | LAND_RECORD | BANK | CERTIFICATE | OTHER
    title: Mapped[str] = mapped_column(String(255))
    filename: Mapped[str | None] = mapped_column(String(512), nullable=True)
    file_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    size: Mapped[int] = mapped_column(Integer, default=0)
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_sample: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ApplicationDocument(Base):
    __tablename__ = "application_documents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    user_document_id: Mapped[str] = mapped_column(ForeignKey("user_documents.id", ondelete="CASCADE"))
    requirement_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
