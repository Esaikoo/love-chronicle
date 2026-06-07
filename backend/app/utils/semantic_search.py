import os
import threading
from functools import lru_cache
from pathlib import Path
from typing import Iterable

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import CheckinImage

IMAGE_MODEL_NAME = os.getenv("CLIP_IMAGE_MODEL", "sentence-transformers/clip-ViT-B-32")
TEXT_MODEL_NAME = os.getenv("CLIP_TEXT_MODEL", "sentence-transformers/clip-ViT-B-32-multilingual-v1")
VIDEO_SUFFIXES = {".mov", ".mp4", ".m4v", ".webm", ".avi"}

_status_lock = threading.Lock()
_index_status = {
    "running": False,
    "total": 0,
    "done": 0,
    "failed": 0,
    "message": "模型待命",
    "modelReady": False,
}


class SemanticIndexError(RuntimeError):
    pass


def vector_literal(values: Iterable[float]) -> str:
    return "[" + ",".join(f"{float(value):.8f}" for value in values) + "]"


@lru_cache(maxsize=1)
def image_model():
    try:
        from sentence_transformers import SentenceTransformer
    except Exception as exc:  # pragma: no cover - optional heavy dependency
        raise SemanticIndexError("sentence-transformers is not installed") from exc
    return SentenceTransformer(IMAGE_MODEL_NAME, device="cpu")


@lru_cache(maxsize=1)
def text_model():
    try:
        from sentence_transformers import SentenceTransformer
    except Exception as exc:  # pragma: no cover - optional heavy dependency
        raise SemanticIndexError("sentence-transformers is not installed") from exc
    return SentenceTransformer(TEXT_MODEL_NAME, device="cpu")


def status_snapshot() -> dict:
    with _status_lock:
        return dict(_index_status)


def update_status(**kwargs) -> None:
    with _status_lock:
        _index_status.update(kwargs)


def warm_models() -> None:
    if status_snapshot().get("modelReady"):
        return
    try:
        update_status(message="正在准备本地语义模型")
        from huggingface_hub import snapshot_download

        snapshot_download(IMAGE_MODEL_NAME)
        snapshot_download(TEXT_MODEL_NAME)
        update_status(modelReady=True, message="语义模型已准备好")
    except Exception as exc:
        update_status(modelReady=False, message=f"模型准备失败：{str(exc)[:160]}")


def warm_models_in_background() -> None:
    threading.Thread(target=warm_models, daemon=True).start()


def local_upload_path(file_url: str) -> Path:
    return Path(file_url.lstrip("/"))


def first_video_frame(path: Path):
    from PIL import Image

    try:
        import cv2
    except Exception as exc:  # pragma: no cover - optional dependency
        raise SemanticIndexError("opencv-python-headless is not installed") from exc
    capture = cv2.VideoCapture(str(path))
    ok, frame = capture.read()
    capture.release()
    if not ok or frame is None:
        raise SemanticIndexError(f"cannot read video frame: {path.name}")
    frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    return Image.fromarray(frame)


def image_for_embedding(path: Path):
    from PIL import Image

    if path.suffix.lower() in VIDEO_SUFFIXES:
        return first_video_frame(path)
    return Image.open(path).convert("RGB")


def encode_image(file_url: str) -> str:
    path = local_upload_path(file_url)
    if not path.exists():
        raise SemanticIndexError(f"file not found: {file_url}")
    with image_for_embedding(path) as image:
        vector = image_model().encode([image], normalize_embeddings=True, show_progress_bar=False)[0]
    return vector_literal(vector)


def encode_text(query: str) -> str:
    vector = text_model().encode([query], normalize_embeddings=True, show_progress_bar=False)[0]
    return vector_literal(vector)


def index_image(db: Session, image: CheckinImage) -> None:
    try:
        embedding = encode_image(image.file_url)
        db.execute(
            text(
                """
                UPDATE checkin_images
                SET embedding = CAST(:embedding AS vector),
                    embedding_model = :model_name,
                    embedding_status = 'ready',
                    embedding_error = NULL,
                    indexed_at = NOW()
                WHERE id = :image_id
                """
            ),
            {"embedding": embedding, "model_name": IMAGE_MODEL_NAME, "image_id": image.id},
        )
    except Exception as exc:
        db.execute(
            text(
                """
                UPDATE checkin_images
                SET embedding_status = 'failed',
                    embedding_error = :error,
                    indexed_at = NOW()
                WHERE id = :image_id
                """
            ),
            {"error": str(exc)[:1000], "image_id": image.id},
        )


def index_checkin_images(image_ids: list[str]) -> None:
    if not image_ids:
        return
    if status_snapshot()["running"]:
        return
    update_status(running=True, total=len(image_ids), done=0, failed=0, message="正在建立照片索引")
    db = SessionLocal()
    try:
        images = db.query(CheckinImage).filter(CheckinImage.id.in_(image_ids)).all()
        for image in images:
            index_image(db, image)
            db.commit()
            current = db.get(CheckinImage, image.id)
            snapshot = status_snapshot()
            update_status(
                done=snapshot["done"] + 1,
                failed=snapshot["failed"] + (1 if current and current.embedding_status == "failed" else 0),
                message="正在建立照片索引",
            )
    finally:
        db.close()
        snapshot = status_snapshot()
        update_status(running=False, message=f"索引完成：{snapshot['done']}/{snapshot['total']}")


def reindex_all_checkin_images() -> None:
    if status_snapshot()["running"]:
        return
    db = SessionLocal()
    try:
        image_ids = [row[0] for row in db.query(CheckinImage.id).all()]
    finally:
        db.close()
    index_checkin_images(image_ids)
