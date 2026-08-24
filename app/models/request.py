import uuid
import enum
from datetime import date, datetime

from sqlalchemy import UUID, Date, DateTime, Enum, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, SharedMixin


class RequestStatus(str, enum.Enum):
    submitted = "submitted"
    under_review = "under_review"
    planned = "planned"
    in_progress = "in_progress"
    completed = "completed"
    declined = "declined"


class RequestPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class Request(SharedMixin, Base):
    __tablename__ = "request"

    request_number: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    requested_by_person_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    status: Mapped[RequestStatus] = mapped_column(
        Enum(RequestStatus, name="request_status_enum"),
        nullable=False,
        default=RequestStatus.submitted,
    )
    priority: Mapped[RequestPriority] = mapped_column(
        Enum(RequestPriority, name="request_priority_enum"),
        nullable=False,
        default=RequestPriority.medium,
    )
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    business_need: Mapped[str | None] = mapped_column(Text, nullable=True)
    decision_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    entity: Mapped["Entity"] = relationship(  # noqa: F821
        "Entity", back_populates="requests"
    )
    requested_by_person: Mapped["Person"] = relationship(  # noqa: F821
        "Person", back_populates="requests"
    )

    __table_args__ = (
        UniqueConstraint("workspace_id", "request_number", name="uq_request_number"),
        Index("ix_request_workspace_status", "workspace_id", "status"),
        Index("ix_request_workspace_priority", "workspace_id", "priority"),
        Index("ix_request_workspace_owner", "workspace_id", "owner_user_id"),
    )
