import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.case import CasePriority, CaseSource, CaseStatus
from .shared import SharedBase, SharedRead


class CaseCreate(SharedBase):
    case_number: str
    subject: str
    description: str
    entity_id: Optional[uuid.UUID] = None
    reported_by_person_id: Optional[uuid.UUID] = None
    status: CaseStatus = CaseStatus.new
    priority: CasePriority = CasePriority.medium
    category: Optional[str] = None
    source: Optional[CaseSource] = None
    due_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    resolution: Optional[str] = None


class CaseUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    subject: Optional[str] = None
    description: Optional[str] = None
    entity_id: Optional[uuid.UUID] = None
    reported_by_person_id: Optional[uuid.UUID] = None
    status: Optional[CaseStatus] = None
    priority: Optional[CasePriority] = None
    category: Optional[str] = None
    source: Optional[CaseSource] = None
    due_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    resolution: Optional[str] = None
    owner_user_id: Optional[uuid.UUID] = None
    updated_by_user_id: Optional[uuid.UUID] = None


class CaseRead(CaseCreate, SharedRead):
    pass
