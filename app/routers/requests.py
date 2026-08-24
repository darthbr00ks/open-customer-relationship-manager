import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.request import Request
from app.schemas.request import RequestCreate, RequestRead, RequestUpdate

router = APIRouter(prefix="/requests", tags=["requests"])


def _get_or_404(db: Session, workspace_id: uuid.UUID, request_id: uuid.UUID) -> Request:
    obj = (
        db.query(Request)
        .filter(Request.workspace_id == workspace_id, Request.id == request_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Request not found")
    return obj


@router.get("", response_model=List[RequestRead])
def list_requests(
    workspace_id: uuid.UUID = Query(...),
    include_archived: bool = Query(False),
    db: Session = Depends(get_db),
):
    q = db.query(Request).filter(Request.workspace_id == workspace_id)
    if not include_archived:
        q = q.filter(Request.archived_at.is_(None))
    return q.all()


@router.post("", response_model=RequestRead, status_code=status.HTTP_201_CREATED)
def create_request(body: RequestCreate, db: Session = Depends(get_db)):
    obj = Request(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/{request_id}", response_model=RequestRead)
def get_request(
    request_id: uuid.UUID,
    workspace_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
):
    return _get_or_404(db, workspace_id, request_id)


@router.patch("/{request_id}", response_model=RequestRead)
def update_request(
    request_id: uuid.UUID,
    body: RequestUpdate,
    workspace_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
):
    obj = _get_or_404(db, workspace_id, request_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    obj.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/{request_id}/archive", response_model=RequestRead)
def archive_request(
    request_id: uuid.UUID,
    workspace_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
):
    obj = _get_or_404(db, workspace_id, request_id)
    obj.archived_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(obj)
    return obj
