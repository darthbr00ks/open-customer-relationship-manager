import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.deal import DealStage
from .shared import SharedBase, SharedRead


class DealCreate(SharedBase):
    name: str
    entity_id: uuid.UUID
    primary_contact_person_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    stage: DealStage = DealStage.qualification
    amount: Optional[Decimal] = None
    currency_code: str = "USD"
    probability: Optional[int] = None
    expected_close_date: Optional[date] = None
    closed_at: Optional[datetime] = None
    next_step: Optional[str] = None
    lost_reason: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def amount_non_negative(cls, v):
        if v is not None and v < 0:
            raise ValueError("amount cannot be negative")
        return v

    @field_validator("probability")
    @classmethod
    def probability_range(cls, v):
        if v is not None and not (0 <= v <= 100):
            raise ValueError("probability must be between 0 and 100")
        return v


class DealUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: Optional[str] = None
    primary_contact_person_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    stage: Optional[DealStage] = None
    amount: Optional[Decimal] = None
    currency_code: Optional[str] = None
    probability: Optional[int] = None
    expected_close_date: Optional[date] = None
    closed_at: Optional[datetime] = None
    next_step: Optional[str] = None
    lost_reason: Optional[str] = None
    notes: Optional[str] = None
    owner_user_id: Optional[uuid.UUID] = None
    updated_by_user_id: Optional[uuid.UUID] = None


class DealRead(DealCreate, SharedRead):
    pass
