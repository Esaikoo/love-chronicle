from uuid import uuid4
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, text
from sqlalchemy.orm import Session
from ..auth import require_writer
from ..database import get_db
from ..models import Checkin, CheckinImage, User
from ..schemas import CheckinIn, CheckinOut, CheckinPhotoSearchOut, IndexStatusOut
from ..utils.semantic_search import encode_text, reindex_all_checkin_images, status_snapshot
from ..utils.time import now_beijing

router = APIRouter()


def out(item: Checkin) -> CheckinOut:
    return CheckinOut(
        id=item.id,
        title=item.title,
        location=item.location,
        date=item.date,
        emoji=item.emoji,
        text=item.text,
        imageUrls=[image.file_url for image in sorted(item.images, key=lambda value: value.sort_order)],
        imageStatuses={image.file_url: image.embedding_status for image in item.images},
        createdBy=item.created_by,
        updatedBy=item.updated_by,
        createdAt=item.created_at,
        updatedAt=item.updated_at
    )


@router.get("", response_model=list[CheckinOut])
def list_checkins(db: Session = Depends(get_db)):
    return [out(item) for item in db.query(Checkin).order_by(func.coalesce(Checkin.updated_at, Checkin.created_at).desc()).all()]


@router.get("/photos/index-status", response_model=IndexStatusOut)
def checkin_photo_index_status(db: Session = Depends(get_db)):
    snapshot = status_snapshot()
    if snapshot.get("running"):
        return IndexStatusOut(**snapshot)

    total = db.query(func.count(CheckinImage.id)).scalar() or 0
    done = db.query(func.count(CheckinImage.id)).filter(CheckinImage.embedding_status == "ready").scalar() or 0
    failed = db.query(func.count(CheckinImage.id)).filter(CheckinImage.embedding_status == "failed").scalar() or 0
    pending = max(total - done - failed, 0)
    message = "照片已整理完成" if pending == 0 and total > 0 else ("还有照片待整理" if total > 0 else "还没有可整理的照片")
    return IndexStatusOut(**{**snapshot, "running": False, "total": total, "done": done, "failed": failed, "message": message})


@router.get("/photos/search", response_model=list[CheckinPhotoSearchOut])
def search_checkin_photos(
    q: str = Query(..., min_length=1),
    limit: int = Query(12, ge=1, le=12),
    db: Session = Depends(get_db)
):
    try:
        query_embedding = encode_text(q)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Semantic model is not ready: {exc}") from exc
    rows = db.execute(
        text(
            """
            SELECT
                ci.id AS image_id,
                ci.file_url AS image_url,
                c.id AS checkin_id,
                c.title AS title,
                c.location AS location,
                c.date AS date,
                1 - (ci.embedding <=> CAST(:embedding AS vector)) AS score
            FROM checkin_images ci
            JOIN checkins c ON c.id = ci.checkin_id
            WHERE ci.embedding IS NOT NULL
            ORDER BY ci.embedding <=> CAST(:embedding AS vector)
            LIMIT :limit
            """
        ),
        {"embedding": query_embedding, "limit": limit},
    ).mappings()
    return [
        CheckinPhotoSearchOut(
            imageId=row["image_id"],
            imageUrl=row["image_url"],
            checkinId=row["checkin_id"],
            title=row["title"],
            location=row["location"],
            date=row["date"],
            score=float(row["score"] or 0),
        )
        for row in rows
    ]


@router.post("/photos/reindex")
def reindex_checkin_photos(background_tasks: BackgroundTasks, user: User = Depends(require_writer)):
    if status_snapshot()["running"]:
        return {"ok": False, "message": "Indexing is already running."}
    background_tasks.add_task(reindex_all_checkin_images)
    return {"ok": True, "message": "Checkin photo indexing has started."}


@router.post("", response_model=CheckinOut)
def create_checkin(payload: CheckinIn, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    item = Checkin(id=uuid4().hex, title=payload.title, location=payload.location, date=payload.date, emoji=payload.emoji, text=payload.text)
    item.created_by = user.role
    item.created_at = now_beijing()
    item.images = [CheckinImage(id=uuid4().hex, file_url=url, sort_order=index, is_primary=index == 0, embedding_status="pending") for index, url in enumerate(payload.imageUrls)]
    db.add(item)
    db.commit()
    db.refresh(item)
    return out(item)


@router.put("/{item_id}", response_model=CheckinOut)
def update_checkin(item_id: str, payload: CheckinIn, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    item = db.get(Checkin, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    item.title = payload.title
    item.location = payload.location
    item.date = payload.date
    item.emoji = payload.emoji
    item.text = payload.text
    item.updated_by = user.role
    item.updated_at = now_beijing()
    item.images.clear()
    item.images = [CheckinImage(id=uuid4().hex, file_url=url, sort_order=index, is_primary=index == 0, embedding_status="pending") for index, url in enumerate(payload.imageUrls)]
    db.commit()
    db.refresh(item)
    return out(item)


@router.delete("/{item_id}")
def delete_checkin(item_id: str, db: Session = Depends(get_db), user: User = Depends(require_writer)):
    item = db.get(Checkin, item_id)
    if item:
        db.delete(item)
        db.commit()
    return {"ok": True}
