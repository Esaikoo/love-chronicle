from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..auth import require_writer
from ..database import get_db
from ..models import CalendarNote, CalendarNoteImage, User
from ..schemas import CalendarNoteIn, CalendarNoteOut
from ..utils.time import now_beijing

router = APIRouter()


def out(item: CalendarNote) -> CalendarNoteOut:
    return CalendarNoteOut(
        date=item.date,
        emoji=item.emoji,
        rating=item.rating,
        ratingMe=item.rating_me,
        ratingHer=item.rating_her,
        text=item.text,
        tags=[tag for tag in item.tags.split(",") if tag],
        imageUrls=[image.file_url for image in item.images],
        createdBy=item.created_by,
        updatedBy=item.updated_by,
        createdAt=item.created_at,
        updatedAt=item.updated_at
    )


@router.get("", response_model=list[CalendarNoteOut])
def list_notes(db: Session = Depends(get_db)):
    return [out(item) for item in db.query(CalendarNote).order_by(CalendarNote.date.desc()).all()]


@router.post("", response_model=CalendarNoteOut)
def create_note(payload: CalendarNoteIn, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    now = now_beijing()
    item = db.get(CalendarNote, payload.date)
    if not item:
        item = CalendarNote(date=payload.date)
        item.created_by = user.role
        item.created_at = now
        db.add(item)
    item.emoji = payload.emoji
    item.rating = payload.rating
    item.rating_me = payload.ratingMe
    item.rating_her = payload.ratingHer
    item.text = payload.text
    item.tags = ",".join(payload.tags)
    item.updated_by = user.role
    item.updated_at = now
    item.images.clear()
    for url in payload.imageUrls:
        item.images.append(CalendarNoteImage(id=uuid4().hex, file_url=url))
    db.commit()
    db.refresh(item)
    return out(item)


@router.put("/{note_date}", response_model=CalendarNoteOut)
def update_note(note_date: str, payload: CalendarNoteIn, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    return create_note(payload, db, user)


@router.delete("/{note_date}")
def delete_note(note_date: str, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    item = db.get(CalendarNote, note_date)
    if item:
        db.delete(item)
        db.commit()
    return {"ok": True}
