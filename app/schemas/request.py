import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.request import RequestPriority, RequestStatus
from .shared import SharedBase, SharedRead


class RequestCreate(SharedBase):
    request_number: str
    title: str
    description: str
    entity_id: Optional[uuid.UUID] = None
    requested_by_person_id: Optional[uuid.UUID] = None
    status: RequestStatus = RequestStatus.submitted
    priority: RequestPriority = RequestPriority.medium
    category: Optional[str] = None
    business_need: Optional[str] = None
    decision_notes: Optional[str] = None
    target_date: Optional[date] = None
    completed_at: Optional[datetime] = None


class RequestUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: Optional[str] = None
    description: Optional[str] = None
    entity_id: Optional[uuid.UUID] = None
    requested_by_person_id: Optional[uuid.UUID] = None
    status: Optional[RequestStatus] = None
    priority: Optional[RequestPriority] = None
    category: Optional[str] = None
    business_need: Optional[str] = None
    decision_notes: Optional[str] = None
    target_date: Optional[date] = None
    completed_at: Optional[datetime] = None
    owner_user_id: Optional[uuid.UUID] = None
    updated_by_user_id: Optional[uuid.UUID] = None


class RequestRead(RequestCreate, SharedRead):
    pass
