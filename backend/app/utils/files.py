from pathlib import Path
from uuid import uuid4
from fastapi import UploadFile

UPLOAD_ROOT = Path("uploads")


def public_url(relative_path: Path) -> str:
    return "/" + relative_path.as_posix()


async def save_upload(file: UploadFile, folder: str) -> str:
    target_dir = UPLOAD_ROOT / folder
    target_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "").suffix.lower()
    name = f"{uuid4().hex}{suffix}"
    target = target_dir / name
    content = await file.read()
    target.write_bytes(content)
    return public_url(target)


def delete_upload(file_url: str | None) -> None:
    if not file_url:
        return
    path = Path(file_url.lstrip("/"))
    if path.exists() and path.is_file():
        path.unlink()
