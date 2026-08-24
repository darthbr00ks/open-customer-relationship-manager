import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entity import Entity
from app.schemas.entity import EntityCreate, EntityRead, EntityUpdate

router = APIRouter(prefix="/entities", tags=["entities"])


def _get_or_404(db: Session, workspace_id: uuid.UUID, entity_id: uuid.UUID) -> Entity:
    obj = (
        db.query(Entity)
        .filter(Entity.workspace_id == workspace_id, Entity.id == entity_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Entity not found")
    return obj


@router.get("", response_model=List[EntityRead])
def list_entities(
    workspace_id: uuid.UUID = Query(...),
    include_archived: bool = Query(False),
    db: Session = Depends(get_db),
):
    q = db.query(Entity).filter(Entity.workspace_id == workspace_id)
    if not include_archived:
        q = q.filter(Entity.archived_at.is_(None))
    return q.all()


@router.post("", response_model=EntityRead, status_code=status.HTTP_201_CREATED)
def create_entity(body: EntityCreate, db: Session = Depends(get_db)):
    obj = Entity(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/{entity_id}", response_model=EntityRead)
def get_entity(
    entity_id: uuid.UUID,
    workspace_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
):
    return _get_or_404(db, workspace_id, entity_id)


@router.patch("/{entity_id}", response_model=EntityRead)
def update_entity(
    entity_id: uuid.UUID,
    body: EntityUpdate,
    workspace_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
):
    obj = _get_or_404(db, workspace_id, entity_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    obj.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/{entity_id}/archive", response_model=EntityRead)
def archive_entity(
    entity_id: uuid.UUID,
    workspace_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
):
    obj = _get_or_404(db, workspace_id, entity_id)
    obj.archived_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(obj)
    return obj
