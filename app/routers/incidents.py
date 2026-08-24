import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.incident import Incident
from app.schemas.incident import IncidentCreate, IncidentRead, IncidentUpdate

router = APIRouter(prefix="/incidents", tags=["incidents"])


def _get_or_404(db: Session, workspace_id: uuid.UUID, incident_id: uuid.UUID) -> Incident:
    obj = (
        db.query(Incident)
        .filter(Incident.workspace_id == workspace_id, Incident.id == incident_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Incident not found")
    return obj


@router.get("", response_model=List[IncidentRead])
def list_incidents(
    workspace_id: uuid.UUID = Query(...),
    include_archived: bool = Query(False),
    db: Session = Depends(get_db),
):
    q = db.query(Incident).filter(Incident.workspace_id == workspace_id)
    if not include_archived:
        q = q.filter(Incident.archived_at.is_(None))
    return q.all()


@router.post("", response_model=IncidentRead, status_code=status.HTTP_201_CREATED)
def create_incident(body: IncidentCreate, db: Session = Depends(get_db)):
    obj = Incident(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/{incident_id}", response_model=IncidentRead)
def get_incident(
    incident_id: uuid.UUID,
    workspace_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
):
    return _get_or_404(db, workspace_id, incident_id)


@router.patch("/{incident_id}", response_model=IncidentRead)
def update_incident(
    incident_id: uuid.UUID,
    body: IncidentUpdate,
    workspace_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
):
    obj = _get_or_404(db, workspace_id, incident_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    obj.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/{incident_id}/archive", response_model=IncidentRead)
def archive_incident(
    incident_id: uuid.UUID,
    workspace_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
):
    obj = _get_or_404(db, workspace_id, incident_id)
    obj.archived_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(obj)
    return obj
