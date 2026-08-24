import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.person import Person
from app.schemas.person import PersonCreate, PersonRead, PersonUpdate

router = APIRouter(prefix="/persons", tags=["persons"])


def _get_or_404(db: Session, workspace_id: uuid.UUID, person_id: uuid.UUID) -> Person:
    obj = (
        db.query(Person)
        .filter(Person.workspace_id == workspace_id, Person.id == person_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Person not found")
    return obj


@router.get("", response_model=List[PersonRead])
def list_persons(
    workspace_id: uuid.UUID = Query(...),
    include_archived: bool = Query(False),
    db: Session = Depends(get_db),
):
    q = db.query(Person).filter(Person.workspace_id == workspace_id)
    if not include_archived:
        q = q.filter(Person.archived_at.is_(None))
    return q.all()


@router.post("", response_model=PersonRead, status_code=status.HTTP_201_CREATED)
def create_person(body: PersonCreate, db: Session = Depends(get_db)):
    obj = Person(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/{person_id}", response_model=PersonRead)
def get_person(
    person_id: uuid.UUID,
    workspace_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
):
    return _get_or_404(db, workspace_id, person_id)


@router.patch("/{person_id}", response_model=PersonRead)
def update_person(
    person_id: uuid.UUID,
    body: PersonUpdate,
    workspace_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
):
    obj = _get_or_404(db, workspace_id, person_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    obj.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/{person_id}/archive", response_model=PersonRead)
def archive_person(
    person_id: uuid.UUID,
    workspace_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
):
    obj = _get_or_404(db, workspace_id, person_id)
    obj.archived_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(obj)
    return obj
