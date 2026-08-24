import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class SharedBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    workspace_id: uuid.UUID
    owner_user_id: Optional[uuid.UUID] = None
    created_by_user_id: Optional[uuid.UUID] = None
    updated_by_user_id: Optional[uuid.UUID] = None
    archived_at: Optional[datetime] = None


class SharedRead(SharedBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
