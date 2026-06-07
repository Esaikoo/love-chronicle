from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..auth import require_writer
from ..database import get_db
from ..models import Preference, User
from ..schemas import PreferenceIn, PreferenceOut
from ..utils.time import now_beijing

router = APIRouter()


def out(item: Preference) -> PreferenceOut:
    return PreferenceOut(
        id=item.id,
        owner=item.owner,
        category=item.category,
        content=item.content,
        emoji=item.emoji,
        note=item.note,
        createdBy=item.created_by,
        updatedBy=item.updated_by,
        createdAt=item.created_at,
        updatedAt=item.updated_at
    )


@router.get("", response_model=list[PreferenceOut])
def list_preferences(db: Session = Depends(get_db)):
    return [out(item) for item in db.query(Preference).order_by(func.coalesce(Preference.updated_at, Preference.created_at).desc()).all()]


@router.post("", response_model=PreferenceOut)
def create_preference(payload: PreferenceIn, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    item = Preference(id=uuid4().hex, owner=payload.owner, category=payload.category, content=payload.content, emoji=payload.emoji, note=payload.note)
    item.created_by = user.role
    item.created_at = now_beijing()
    db.add(item)
    db.commit()
    db.refresh(item)
    return out(item)


@router.put("/{item_id}", response_model=PreferenceOut)
def update_preference(item_id: str, payload: PreferenceIn, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    item = db.get(Preference, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    item.owner = payload.owner
    item.category = payload.category
    item.content = payload.content
    item.emoji = payload.emoji
    item.note = payload.note
    item.updated_by = user.role
    item.updated_at = now_beijing()
    db.commit()
    db.refresh(item)
    return out(item)


@router.delete("/{item_id}")
def delete_preference(item_id: str, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    item = db.get(Preference, item_id)
    if item:
        db.delete(item)
        db.commit()
    return {"ok": True}
