import uuid
import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import UUID, Date, DateTime, Enum, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, SharedMixin


class DealStage(str, enum.Enum):
    qualification = "qualification"
    discovery = "discovery"
    proposal = "proposal"
    negotiation = "negotiation"
    won = "won"
    lost = "lost"


class Deal(SharedMixin, Base):
    __tablename__ = "deal"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    primary_contact_person_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    stage: Mapped[DealStage] = mapped_column(
        Enum(DealStage, name="deal_stage_enum"),
        nullable=False,
        default=DealStage.qualification,
    )
    amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    probability: Mapped[int | None] = mapped_column(Integer, nullable=True)
    expected_close_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_step: Mapped[str | None] = mapped_column(Text, nullable=True)
    lost_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    entity: Mapped["Entity"] = relationship(  # noqa: F821
        "Entity", back_populates="deals"
    )

    __table_args__ = (
        Index("ix_deal_workspace_entity", "workspace_id", "entity_id"),
        Index("ix_deal_workspace_stage", "workspace_id", "stage"),
        Index("ix_deal_workspace_owner", "workspace_id", "owner_user_id"),
        Index("ix_deal_expected_close_date", "workspace_id", "expected_close_date"),
    )
