from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..auth import require_writer
from ..database import get_db
from ..models import Countdown, User
from ..schemas import CountdownIn, CountdownOut
from ..utils.time import now_beijing

router = APIRouter()


def out(item: Countdown) -> CountdownOut:
    return CountdownOut(
        id=item.id,
        title=item.title,
        targetDate=item.target_date,
        description=item.description,
        emoji=item.emoji,
        coverUrl=item.cover_url,
        type=item.type,
        status=item.status,
        createdBy=item.created_by,
        updatedBy=item.updated_by,
        createdAt=item.created_at,
        updatedAt=item.updated_at,
        completedAt=item.completed_at
    )


@router.get("", response_model=list[CountdownOut])
def list_countdowns(db: Session = Depends(get_db)):
    return [out(item) for item in db.query(Countdown).order_by(func.coalesce(Countdown.updated_at, Countdown.created_at).desc()).all()]


@router.post("", response_model=CountdownOut)
def create_countdown(payload: CountdownIn, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    item = Countdown(id=uuid4().hex, title=payload.title, target_date=payload.targetDate, description=payload.description, emoji=payload.emoji, cover_url=payload.coverUrl, type=payload.type, status=payload.status)
    item.created_by = user.role
    item.created_at = now_beijing()
    db.add(item)
    db.commit()
    db.refresh(item)
    return out(item)


@router.put("/{item_id}", response_model=CountdownOut)
def update_countdown(item_id: str, payload: CountdownIn, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    item = db.get(Countdown, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    now = now_beijing()
    item.title = payload.title
    item.target_date = payload.targetDate
    item.description = payload.description
    item.emoji = payload.emoji
    item.cover_url = payload.coverUrl
    item.type = payload.type
    item.status = payload.status
    item.completed_at = now if payload.status == "completed" and not item.completed_at else None if payload.status != "completed" else item.completed_at
    item.updated_by = user.role
    item.updated_at = now
    db.commit()
    db.refresh(item)
    return out(item)


@router.delete("/{item_id}")
def delete_countdown(item_id: str, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    item = db.get(Countdown, item_id)
    if item:
        db.delete(item)
        db.commit()
    return {"ok": True}
