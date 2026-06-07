from fastapi import APIRouter, Depends, File, UploadFile
from ..auth import require_writer
from ..models import User
from ..utils.files import save_upload

router = APIRouter()


@router.post("")
async def upload_file(kind: str, file: UploadFile = File(...), user: User = Depends(require_writer)):
    folder = kind if kind in {"photos", "music", "covers", "calendar", "checkins", "travel"} else "photos"
    return {"url": await save_upload(file, folder)}
