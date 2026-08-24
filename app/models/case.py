import uuid
import enum
from datetime import datetime

from sqlalchemy import UUID, DateTime, Enum, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, SharedMixin


class CaseStatus(str, enum.Enum):
    new = "new"
    open = "open"
    pending = "pending"
    resolved = "resolved"
    closed = "closed"


class CasePriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class CaseSource(str, enum.Enum):
    email = "email"
    phone = "phone"
    web = "web"
    internal = "internal"
    integration = "integration"
    other = "other"


class Case(SharedMixin, Base):
    __tablename__ = "case"

    case_number: Mapped[str] = mapped_column(String(50), nullable=False)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    reported_by_person_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    status: Mapped[CaseStatus] = mapped_column(
        Enum(CaseStatus, name="case_status_enum"),
        nullable=False,
        default=CaseStatus.new,
    )
    priority: Mapped[CasePriority] = mapped_column(
        Enum(CasePriority, name="case_priority_enum"),
        nullable=False,
        default=CasePriority.medium,
    )
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source: Mapped[CaseSource | None] = mapped_column(
        Enum(CaseSource, name="case_source_enum"), nullable=True
    )
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    entity: Mapped["Entity"] = relationship(  # noqa: F821
        "Entity", back_populates="cases"
    )
    reported_by_person: Mapped["Person"] = relationship(  # noqa: F821
        "Person", back_populates="cases"
    )
    incident_cases: Mapped[list["IncidentCase"]] = relationship(  # noqa: F821
        "IncidentCase", back_populates="case"
    )

    __table_args__ = (
        UniqueConstraint("workspace_id", "case_number", name="uq_case_number"),
        Index("ix_case_workspace_status", "workspace_id", "status"),
        Index("ix_case_workspace_priority", "workspace_id", "priority"),
        Index("ix_case_workspace_owner", "workspace_id", "owner_user_id"),
    )
