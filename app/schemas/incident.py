import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.incident import IncidentSeverity, IncidentStatus
from .shared import SharedBase, SharedRead


class IncidentCreate(SharedBase):
    incident_number: str
    title: str
    description: str
    status: IncidentStatus = IncidentStatus.investigating
    severity: IncidentSeverity
    started_at: Optional[datetime] = None
    identified_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    root_cause: Optional[str] = None
    resolution: Optional[str] = None
    internal_notes: Optional[str] = None
    public_update: Optional[str] = None


class IncidentUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[IncidentStatus] = None
    severity: Optional[IncidentSeverity] = None
    started_at: Optional[datetime] = None
    identified_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    root_cause: Optional[str] = None
    resolution: Optional[str] = None
    internal_notes: Optional[str] = None
    public_update: Optional[str] = None
    owner_user_id: Optional[uuid.UUID] = None
    updated_by_user_id: Optional[uuid.UUID] = None


class IncidentRead(IncidentCreate, SharedRead):
    pass
