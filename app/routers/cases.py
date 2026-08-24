import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.case import Case
from app.schemas.case import CaseCreate, CaseRead, CaseUpdate

router = APIRouter(prefix="/cases", tags=["cases"])


def _get_or_404(db: Session, workspace_id: uuid.UUID, case_id: uuid.UUID) -> Case:
    obj = (
        db.query(Case)
        .filter(Case.workspace_id == workspace_id, Case.id == case_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Case not found")
    return obj


@router.get("", response_model=List[CaseRead])
def list_cases(
    workspace_id: uuid.UUID = Query(...),
    include_archived: bool = Query(False),
    db: Session = Depends(get_db),
):
    q = db.query(Case).filter(Case.workspace_id == workspace_id)
    if not include_archived:
        q = q.filter(Case.archived_at.is_(None))
    return q.all()


@router.post("", response_model=CaseRead, status_code=status.HTTP_201_CREATED)
def create_case(body: CaseCreate, db: Session = Depends(get_db)):
    obj = Case(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/{case_id}", response_model=CaseRead)
def get_case(
    case_id: uuid.UUID,
    workspace_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
):
    return _get_or_404(db, workspace_id, case_id)


@router.patch("/{case_id}", response_model=CaseRead)
def update_case(
    case_id: uuid.UUID,
    body: CaseUpdate,
    workspace_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
):
    obj = _get_or_404(db, workspace_id, case_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    obj.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/{case_id}/archive", response_model=CaseRead)
def archive_case(
    case_id: uuid.UUID,
    workspace_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
):
    obj = _get_or_404(db, workspace_id, case_id)
    obj.archived_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(obj)
    return obj
