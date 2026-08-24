import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.incident_case import ImpactLevel


class IncidentCaseCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    workspace_id: uuid.UUID
    incident_id: uuid.UUID
    case_id: uuid.UUID
    entity_id: uuid.UUID
    impact_level: Optional[ImpactLevel] = None
    impact_description: Optional[str] = None
    created_by_user_id: Optional[uuid.UUID] = None


class IncidentCaseUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    impact_level: Optional[ImpactLevel] = None
    impact_description: Optional[str] = None
    unlinked_at: Optional[datetime] = None


class IncidentCaseRead(IncidentCaseCreate):
    id: uuid.UUID
    linked_at: datetime
    unlinked_at: Optional[datetime] = None
