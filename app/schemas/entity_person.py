import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.entity_person import AffiliationStatus, RelationshipType


class EntityPersonCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    workspace_id: uuid.UUID
    entity_id: uuid.UUID
    person_id: uuid.UUID
    relationship_type: RelationshipType
    job_title: Optional[str] = None
    department: Optional[str] = None
    is_primary_contact: bool = False
    status: AffiliationStatus = AffiliationStatus.current
    started_on: Optional[date] = None
    ended_on: Optional[date] = None
    notes: Optional[str] = None


class EntityPersonUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    relationship_type: Optional[RelationshipType] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    is_primary_contact: Optional[bool] = None
    status: Optional[AffiliationStatus] = None
    started_on: Optional[date] = None
    ended_on: Optional[date] = None
    notes: Optional[str] = None


class EntityPersonRead(EntityPersonCreate):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
