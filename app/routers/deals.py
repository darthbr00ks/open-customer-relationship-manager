import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.deal import Deal
from app.schemas.deal import DealCreate, DealRead, DealUpdate

router = APIRouter(prefix="/deals", tags=["deals"])


def _get_or_404(db: Session, workspace_id: uuid.UUID, deal_id: uuid.UUID) -> Deal:
    obj = (
        db.query(Deal)
        .filter(Deal.workspace_id == workspace_id, Deal.id == deal_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Deal not found")
    return obj


@router.get("", response_model=List[DealRead])
def list_deals(
    workspace_id: uuid.UUID = Query(...),
    include_archived: bool = Query(False),
    db: Session = Depends(get_db),
):
    q = db.query(Deal).filter(Deal.workspace_id == workspace_id)
    if not include_archived:
        q = q.filter(Deal.archived_at.is_(None))
    return q.all()


@router.post("", response_model=DealRead, status_code=status.HTTP_201_CREATED)
def create_deal(body: DealCreate, db: Session = Depends(get_db)):
    obj = Deal(**body.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/{deal_id}", response_model=DealRead)
def get_deal(
    deal_id: uuid.UUID,
    workspace_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
):
    return _get_or_404(db, workspace_id, deal_id)


@router.patch("/{deal_id}", response_model=DealRead)
def update_deal(
    deal_id: uuid.UUID,
    body: DealUpdate,
    workspace_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
):
    obj = _get_or_404(db, workspace_id, deal_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    obj.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/{deal_id}/archive", response_model=DealRead)
def archive_deal(
    deal_id: uuid.UUID,
    workspace_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
):
    obj = _get_or_404(db, workspace_id, deal_id)
    obj.archived_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(obj)
    return obj
