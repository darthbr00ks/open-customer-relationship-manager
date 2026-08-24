from datetime import datetime
from sqlalchemy import DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, SharedMixin


class Person(SharedMixin, Base):
    __tablename__ = "person"

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    preferred_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    primary_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    primary_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    entity_persons: Mapped[list["EntityPerson"]] = relationship(  # noqa: F821
        "EntityPerson", back_populates="person"
    )
    cases: Mapped[list["Case"]] = relationship(  # noqa: F821
        "Case", back_populates="reported_by_person"
    )
    requests: Mapped[list["Request"]] = relationship(  # noqa: F821
        "Request", back_populates="requested_by_person"
    )

    __table_args__ = (
        Index("ix_person_workspace_last_name", "workspace_id", "last_name"),
        Index("ix_person_workspace_email", "workspace_id", "primary_email"),
    )
