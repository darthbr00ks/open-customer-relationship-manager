import uuid
import enum
from datetime import datetime

from sqlalchemy import UUID, DateTime, Enum, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class ImpactLevel(str, enum.Enum):
    minor = "minor"
    moderate = "moderate"
    major = "major"
    critical = "critical"


class IncidentCase(Base):
    __tablename__ = "incident_case"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    incident_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    case_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    impact_level: Mapped[ImpactLevel | None] = mapped_column(
        Enum(ImpactLevel, name="impact_level_enum"), nullable=True
    )
    impact_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    linked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )
    unlinked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )

    # Relationships
    incident: Mapped["Incident"] = relationship(  # noqa: F821
        "Incident", back_populates="incident_cases"
    )
    case: Mapped["Case"] = relationship(  # noqa: F821
        "Case", back_populates="incident_cases"
    )
    entity: Mapped["Entity"] = relationship(  # noqa: F821
        "Entity", back_populates="incident_cases"
    )

    __table_args__ = (
        UniqueConstraint("incident_id", "case_id", name="uq_incident_case"),
        Index("ix_incident_case_workspace", "workspace_id"),
        Index("ix_incident_case_entity", "workspace_id", "entity_id"),
    )
