import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.incident_case import IncidentCase
from app.schemas.incident_case import IncidentCaseCreate, IncidentCaseRead, IncidentCaseUpdate

router = APIRouter(prefix="/incident-cases", tags=["incident-cases"])


def _get_or_404(db: Session, ic_id: uuid.UUID) -> IncidentCase:
    obj = db.query(IncidentCase).filter(IncidentCase.id == ic_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="IncidentCase not found")
    return obj


@router.get("", response_model=List[IncidentCaseRead])
def list_incident_cases(
    workspace_id: uuid.UUID = Query(...),
    incident_id: uuid.UUID | None = Query(None),
    case_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(IncidentCase).filter(IncidentCase.workspace_id == workspace_id)
    if incident_id:
        q = q.filter(IncidentCase.incident_id == incident_id)
    if case_id:
        q = q.filter(IncidentCase.case_id == case_id)
    return q.all()


@router.post("", response_model=IncidentCaseRead, status_code=status.HTTP_201_CREATED)
def create_incident_case(body: IncidentCaseCreate, db: Session = Depends(get_db)):
    obj = IncidentCase(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/{ic_id}", response_model=IncidentCaseRead)
def get_incident_case(ic_id: uuid.UUID, db: Session = Depends(get_db)):
    return _get_or_404(db, ic_id)


@router.patch("/{ic_id}", response_model=IncidentCaseRead)
def update_incident_case(
    ic_id: uuid.UUID,
    body: IncidentCaseUpdate,
    db: Session = Depends(get_db),
):
    obj = _get_or_404(db, ic_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj
