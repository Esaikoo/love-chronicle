from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import current_user, require_writer
from ..database import get_db
from ..models import Letter, User
from ..schemas import LetterIn, LetterOut
from ..utils.time import now_beijing

router = APIRouter()


def out(item: Letter) -> LetterOut:
    return LetterOut(
        id=item.id,
        title=item.title,
        content=item.content,
        fromUser=item.from_user,
        toUser=item.to_user,
        emoji=item.emoji,
        envelopeStyle=item.envelope_style,
        isPublic=item.is_public,
        createdBy=item.created_by,
        createdAt=item.created_at,
        updatedAt=item.updated_at,
    )


def visible_query(db: Session, user: User | None):
    query = db.query(Letter)
    if not user or user.role not in {"me", "her"}:
        query = query.filter(Letter.is_public.is_(True))
    return query


@router.get("", response_model=list[LetterOut])
def list_letters(
    q: str = "",
    from_user: str = Query(default="", alias="from"),
    to_user: str = Query(default="", alias="to"),
    db: Session = Depends(get_db),
    user: User | None = Depends(current_user),
):
    query = visible_query(db, user)
    if q.strip():
        keyword = f"%{q.strip()}%"
        query = query.filter(or_(Letter.title.ilike(keyword), Letter.content.ilike(keyword)))
    if from_user.strip():
        query = query.filter(Letter.from_user.ilike(f"%{from_user.strip()}%"))
    if to_user.strip():
        query = query.filter(Letter.to_user.ilike(f"%{to_user.strip()}%"))
    return [out(item) for item in query.order_by(Letter.created_at.asc(), Letter.id.asc()).all()]


@router.get("/{letter_id}", response_model=LetterOut)
def get_letter(letter_id: str, db: Session = Depends(get_db), user: User | None = Depends(current_user)):
    item = db.get(Letter, letter_id)
    if not item or ((not user or user.role not in {"me", "her"}) and not item.is_public):
        raise HTTPException(status_code=404, detail="Letter not found")
    return out(item)


@router.post("", response_model=LetterOut)
def create_letter(payload: LetterIn, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    now = now_beijing()
    item = Letter(
        id=uuid4().hex,
        title=payload.title.strip(),
        content=payload.content,
        from_user=payload.fromUser.strip(),
        to_user=payload.toUser.strip(),
        emoji=payload.emoji or "💌",
        envelope_style=payload.envelopeStyle or "sakura",
        is_public=payload.isPublic,
        created_by=user.role,
        created_at=payload.createdAt or now,
    )
    if not item.title:
        raise HTTPException(status_code=400, detail="Title is required")
    db.add(item)
    db.commit()
    db.refresh(item)
    return out(item)


@router.put("/{letter_id}", response_model=LetterOut)
def update_letter(letter_id: str, payload: LetterIn, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    item = db.get(Letter, letter_id)
    if not item:
        raise HTTPException(status_code=404, detail="Letter not found")
    if item.created_by != user.role:
        raise HTTPException(status_code=403, detail="只有写这封信的人可以编辑")
    item.title = payload.title.strip()
    item.content = payload.content
    item.from_user = payload.fromUser.strip()
    item.to_user = payload.toUser.strip()
    item.emoji = payload.emoji or "💌"
    item.envelope_style = payload.envelopeStyle or "sakura"
    item.is_public = payload.isPublic
    item.created_at = payload.createdAt or item.created_at
    item.updated_at = now_beijing()
    db.commit()
    db.refresh(item)
    return out(item)


@router.delete("/{letter_id}")
def delete_letter(letter_id: str, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    item = db.get(Letter, letter_id)
    if not item:
        return {"ok": True}
    if item.created_by != user.role:
        raise HTTPException(status_code=403, detail="只有写这封信的人可以删除")
    db.delete(item)
    db.commit()
    return {"ok": True}
