import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict

from .shared import SharedBase, SharedRead


class PersonCreate(SharedBase):
    first_name: str
    last_name: Optional[str] = None
    preferred_name: Optional[str] = None
    primary_email: Optional[str] = None
    primary_phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None


class PersonUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    first_name: Optional[str] = None
    last_name: Optional[str] = None
    preferred_name: Optional[str] = None
    primary_email: Optional[str] = None
    primary_phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    owner_user_id: Optional[uuid.UUID] = None
    updated_by_user_id: Optional[uuid.UUID] = None


class PersonRead(PersonCreate, SharedRead):
    pass
