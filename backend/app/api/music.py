from uuid import uuid4
from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session
from ..auth import require_writer
from ..database import get_db
from ..models import MusicTrack, User
from ..schemas import MusicOut
from ..utils.files import delete_upload, save_upload

router = APIRouter()


def out(track: MusicTrack) -> MusicOut:
    return MusicOut(
        id=track.id,
        title=track.title,
        artist=track.artist,
        duration=track.duration,
        src=track.file_url,
        coverSrc=track.cover_url,
        createdAt=track.created_at
    )


@router.get("", response_model=list[MusicOut])
def list_music(db: Session = Depends(get_db)):
    return [out(item) for item in db.query(MusicTrack).order_by(MusicTrack.created_at.desc()).all()]


@router.post("", response_model=MusicOut)
async def create_music(
    file: UploadFile = File(...),
    title: str = Form(...),
    artist: str = Form("Local"),
    duration: int | None = Form(None),
    cover: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_writer)
):
    file_url = await save_upload(file, "music")
    cover_url = await save_upload(cover, "covers") if cover else None
    track = MusicTrack(id=uuid4().hex, title=title, artist=artist, duration=duration, file_url=file_url, cover_url=cover_url, created_by=user.role)
    db.add(track)
    db.commit()
    db.refresh(track)
    return out(track)


@router.put("/{track_id}", response_model=MusicOut)
def update_music(track_id: str, title: str = Form(...), artist: str = Form("Local"), db: Session = Depends(get_db), user: User = Depends(require_writer)):
    track = db.get(MusicTrack, track_id)
    if not track:
        raise ValueError("Not found")
    track.title = title
    track.artist = artist
    db.commit()
    db.refresh(track)
    return out(track)


@router.delete("/{track_id}")
def delete_music(track_id: str, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    track = db.get(MusicTrack, track_id)
    if track:
        delete_upload(track.file_url)
        delete_upload(track.cover_url)
        db.delete(track)
        db.commit()
    return {"ok": True}
