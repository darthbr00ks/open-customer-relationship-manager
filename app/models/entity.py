import uuid
import enum

from sqlalchemy import UUID, Enum, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, SharedMixin


class EntityType(str, enum.Enum):
    company = "company"
    nonprofit = "nonprofit"
    government = "government"
    education = "education"
    association = "association"
    household = "household"
    other = "other"


class RelationshipStage(str, enum.Enum):
    prospect = "prospect"
    customer = "customer"
    partner = "partner"
    former_customer = "former_customer"
    inactive = "inactive"


class Entity(SharedMixin, Base):
    __tablename__ = "entity"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    legal_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    entity_type: Mapped[EntityType] = mapped_column(
        Enum(EntityType, name="entity_type_enum"), nullable=False
    )
    relationship_stage: Mapped[RelationshipStage] = mapped_column(
        Enum(RelationshipStage, name="relationship_stage_enum"),
        nullable=False,
        default=RelationshipStage.prospect,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    primary_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    primary_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    primary_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address_line_1: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_line_2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    region: Mapped[str | None] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    country_code: Mapped[str | None] = mapped_column(String(2), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    entity_persons: Mapped[list["EntityPerson"]] = relationship(  # noqa: F821
        "EntityPerson", back_populates="entity"
    )
    deals: Mapped[list["Deal"]] = relationship(  # noqa: F821
        "Deal", back_populates="entity"
    )
    cases: Mapped[list["Case"]] = relationship(  # noqa: F821
        "Case", back_populates="entity"
    )
    requests: Mapped[list["Request"]] = relationship(  # noqa: F821
        "Request", back_populates="entity"
    )
    incident_cases: Mapped[list["IncidentCase"]] = relationship(  # noqa: F821
        "IncidentCase", back_populates="entity"
    )

    __table_args__ = (
        Index("ix_entity_workspace_name", "workspace_id", "name"),
        Index("ix_entity_workspace_stage", "workspace_id", "relationship_stage"),
        Index("ix_entity_workspace_domain", "workspace_id", "primary_domain"),
    )
