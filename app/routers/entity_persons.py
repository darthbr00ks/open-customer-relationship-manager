import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entity_person import EntityPerson
from app.schemas.entity_person import EntityPersonCreate, EntityPersonRead, EntityPersonUpdate

router = APIRouter(prefix="/entity-persons", tags=["entity-persons"])


def _get_or_404(db: Session, ep_id: uuid.UUID) -> EntityPerson:
    obj = db.query(EntityPerson).filter(EntityPerson.id == ep_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="EntityPerson not found")
    return obj


@router.get("", response_model=List[EntityPersonRead])
def list_entity_persons(
    workspace_id: uuid.UUID = Query(...),
    entity_id: uuid.UUID | None = Query(None),
    person_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(EntityPerson).filter(EntityPerson.workspace_id == workspace_id)
    if entity_id:
        q = q.filter(EntityPerson.entity_id == entity_id)
    if person_id:
        q = q.filter(EntityPerson.person_id == person_id)
    return q.all()


@router.post("", response_model=EntityPersonRead, status_code=status.HTTP_201_CREATED)
def create_entity_person(body: EntityPersonCreate, db: Session = Depends(get_db)):
    obj = EntityPerson(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/{ep_id}", response_model=EntityPersonRead)
def get_entity_person(ep_id: uuid.UUID, db: Session = Depends(get_db)):
    return _get_or_404(db, ep_id)


@router.patch("/{ep_id}", response_model=EntityPersonRead)
def update_entity_person(
    ep_id: uuid.UUID,
    body: EntityPersonUpdate,
    db: Session = Depends(get_db),
):
    obj = _get_or_404(db, ep_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    obj.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(obj)
    return obj
