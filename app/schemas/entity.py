import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.entity import EntityType, RelationshipStage
from .shared import SharedBase, SharedRead


class EntityCreate(SharedBase):
    name: str
    entity_type: EntityType
    relationship_stage: RelationshipStage = RelationshipStage.prospect
    legal_name: Optional[str] = None
    description: Optional[str] = None
    website_url: Optional[str] = None
    primary_domain: Optional[str] = None
    primary_email: Optional[str] = None
    primary_phone: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    postal_code: Optional[str] = None
    country_code: Optional[str] = None
    notes: Optional[str] = None


class EntityUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: Optional[str] = None
    entity_type: Optional[EntityType] = None
    relationship_stage: Optional[RelationshipStage] = None
    legal_name: Optional[str] = None
    description: Optional[str] = None
    website_url: Optional[str] = None
    primary_domain: Optional[str] = None
    primary_email: Optional[str] = None
    primary_phone: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    postal_code: Optional[str] = None
    country_code: Optional[str] = None
    notes: Optional[str] = None
    owner_user_id: Optional[uuid.UUID] = None
    updated_by_user_id: Optional[uuid.UUID] = None


class EntityRead(EntityCreate, SharedRead):
    pass
