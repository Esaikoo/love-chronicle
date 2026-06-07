from uuid import uuid4
from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session
from ..auth import require_writer
from ..database import get_db
from ..models import HeartPhoto, User
from ..schemas import PhotoOut
from ..utils.files import delete_upload, save_upload

router = APIRouter()


def out(photo: HeartPhoto) -> PhotoOut:
    return PhotoOut(id=photo.id, title=photo.title, description=photo.description, src=photo.file_url, createdAt=photo.created_at)


@router.get("", response_model=list[PhotoOut])
def list_photos(db: Session = Depends(get_db)):
    return [out(item) for item in db.query(HeartPhoto).order_by(HeartPhoto.created_at.desc()).all()]


@router.post("", response_model=PhotoOut)
async def create_photo(
    file: UploadFile = File(...),
    title: str | None = Form(None),
    description: str | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_writer)
):
    file_url = await save_upload(file, "photos")
    photo = HeartPhoto(id=uuid4().hex, title=title or file.filename, description=description, file_url=file_url, created_by=user.role)
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return out(photo)


@router.delete("/{photo_id}")
def delete_photo(photo_id: str, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    photo = db.get(HeartPhoto, photo_id)
    if photo:
        delete_upload(photo.file_url)
        db.delete(photo)
        db.commit()
    return {"ok": True}


@router.put("/{photo_id}", response_model=PhotoOut)
def update_photo(
    photo_id: str,
    title: str | None = Form(None),
    description: str | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_writer)
):
    photo = db.get(HeartPhoto, photo_id)
    if not photo:
        raise ValueError("Not found")
    photo.title = title
    photo.description = description
    db.commit()
    db.refresh(photo)
    return out(photo)
