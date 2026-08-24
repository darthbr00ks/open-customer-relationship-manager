import uuid
import enum
from datetime import date, datetime

from sqlalchemy import UUID, Boolean, Date, DateTime, Enum, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class RelationshipType(str, enum.Enum):
    employee = "employee"
    owner = "owner"
    advisor = "advisor"
    board_member = "board_member"
    volunteer = "volunteer"
    contractor = "contractor"
    customer_contact = "customer_contact"
    other = "other"


class AffiliationStatus(str, enum.Enum):
    current = "current"
    former = "former"


class EntityPerson(Base):
    __tablename__ = "entity_person"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    person_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    relationship_type: Mapped[RelationshipType] = mapped_column(
        Enum(RelationshipType, name="relationship_type_enum"), nullable=False
    )
    job_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    department: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_primary_contact: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[AffiliationStatus] = mapped_column(
        Enum(AffiliationStatus, name="affiliation_status_enum"),
        nullable=False,
        default=AffiliationStatus.current,
    )
    started_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    ended_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    entity: Mapped["Entity"] = relationship(  # noqa: F821
        "Entity", back_populates="entity_persons"
    )
    person: Mapped["Person"] = relationship(  # noqa: F821
        "Person", back_populates="entity_persons"
    )

    __table_args__ = (
        UniqueConstraint("workspace_id", "entity_id", "person_id", name="uq_entity_person"),
        Index("ix_entity_person_workspace", "workspace_id"),
    )
